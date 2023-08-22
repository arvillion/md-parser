import { ListItem, Node, NodeType, ListItemMarker, List, Blockquote, HtmlBlock, Paragraph, PontentialParagraph, ChildrenContainer, AtxHeadingLevel, SetextHeading, BlockNode, ContainerExit, BlankLine, IndentedCodeBlock, ThematicBreak, AtxHeading, FencedCodeBlock, Ref, RefMap, LinkRefDef } from "./types"
import createRBTree from 'functional-red-black-tree'
import { htmlBlockRules, linkRefRules } from './rules'
import { DoublyLinkedList, DoublyLinkedListItem } from "./DoublyLinkedList"
import { removeFinalLineBreak, restoreBackslashEscapes, trimParagraph } from "./utils"

interface CachedBlock {
  nextIdx: number,
  node: BlockNode
}

interface LineInfo {
  identNum: number

  invalidContIdx: number
  isPrefixOk: boolean

  lineBeginIdx: number

  rollbackIdx: number
  isBlankLine: boolean
  blankLines: number
}



const containerExit: ContainerExit = {
  type: NodeType.CONTAINER_EXIT
}

const blankLine: BlankLine = {
  type: NodeType.BLANK_LINE
}

export class BlockParser {
  _raw: string
  _idx: number

  // A line containing no characters, or a line containing only spaces (U+0020) or tabs (U+0009), is called a blank line.
  _blankLinePattern = /[ \t]*(?:\n|$)/y
  _paragraphPattern = /.*(?:\n|$)/y
  _identedCodePattern = /     ?.*(?:\n|$)/y
  _linePattern = /.*(?:\n|$)/y


  _cachedBlocks = createRBTree<number, BlockNode[]>()

  _lastBlocks: (BlockNode | null)[] = [null]
  _linkRefs: Ref[] = []


  constructor(raw: string) {
    this._idx = 0
    this._raw = raw
  }

  _getCache() : CachedBlock | null {
    const { _cachedBlocks: cachedBlocks } = this

    const it = cachedBlocks.begin
    if (it.value) {
      // @ts-ignore
      const ret = it.value[0]
      // @ts-ignore
      this._idx = it.key
      if (it.value.length === 1) {
        this._cachedBlocks = it.remove()
      } else {
        this._cachedBlocks = it.update(it.value.slice(1))
      }
      return {
        node: ret,
        // @ts-ignore
        nextIdx: it.key
      }
    }
    return null
  }

  _storeCache(key: number, ...items: BlockNode[]) {
    if (!items.length) return
    const { _cachedBlocks: cachedBlocks } = this
    const it = cachedBlocks.get(key)
    if (it) {
      throw Error("not allowed")
    } else {
      this._cachedBlocks = cachedBlocks.insert(key, items)
    }
  }

  _storeCache_front(key: number, ...items: BlockNode[]) {
    const { _cachedBlocks: cachedBlocks } = this
    const it = cachedBlocks.get(key)
    if (it) {
      it.unshift(...items)
    } else {
      this._cachedBlocks = cachedBlocks.insert(key, items)
    }
  }

  nextBlock(): BlockNode {
    const cache = this._getCache()
    if (cache) {
      return cache.node
    } else {
      return this._nextBlock([])
    }
  }

  dumpRef(): RefMap {
    const m: RefMap = {}
    this._linkRefs.forEach(v => {
      m[v.label] = v
    }) 
    return m
  }

  _nextLine({
    contStack = [], 
    skipIdentation = true,
    skipInitialPrefixCheck = false
  }: {
    contStack?: string[]
    skipIdentation?: boolean
    skipInitialPrefixCheck?: boolean
  } = {}): LineInfo | null {

    
    const { 
      _raw: raw,
      _blankLinePattern: blankLinePattern
    } = this

    if (this._idx >= raw.length) return null

    let invalidContIdx = 0
    let isPrefixOk = true
    const rollbackIdx = this._idx
    let isBlankLine = false
    let blankLines = 0
    let lineBeginIdx = this._idx
    let identNum = 0

    if (!skipInitialPrefixCheck) {
      const checkResult = this._checkPrefix(contStack)
      isPrefixOk = checkResult.isPrefixOk
      invalidContIdx = checkResult.invalidContIdx 
    }
    identNum = this._skipIndentation()

    if (!skipIdentation) {
      this._idx -= identNum
    }

    const currContStack = isPrefixOk ? contStack : contStack.slice(0, invalidContIdx)
    blankLinePattern.lastIndex = this._idx

    let finalIdx = this._idx
    while (blankLinePattern.test(raw)) {
      isBlankLine = true
      this._idx = blankLinePattern.lastIndex
      finalIdx = blankLinePattern.lastIndex
      this._skipIndentation()
      if (!this._checkPrefix(currContStack).isPrefixOk) {
        break
      }
      blankLinePattern.lastIndex = this._idx
      blankLines++
    }
    this._idx = finalIdx

    return {
      identNum,
      isBlankLine,
      invalidContIdx,
      isPrefixOk,
      lineBeginIdx,
      rollbackIdx,
      blankLines
    }
  }

  _checkPrefix(contStack: string[]) {
    const { 
      _raw: raw,
    } = this
    let invalidContIdx = 0
    let isPrefixOk = true
    // TODO: do not invoke skipIndentation before _checkPrefix

    const arrowPattern = / {0,3}> ?/y

    if (contStack.length) {
      for (; invalidContIdx < contStack.length; invalidContIdx++) {
        const cont = contStack[invalidContIdx]
        let shouldContinue = true
        if (cont === '>') {
          arrowPattern.lastIndex = this._idx
          if (arrowPattern.test(raw)) {
            this._idx = arrowPattern.lastIndex
          } else {
            shouldContinue = false
          }
        } else {
          // spaces
          if (raw.slice(this._idx).startsWith(cont)) {
            this._idx += cont.length
          } else {
            shouldContinue = false
          }
        }

        if (!shouldContinue) {
          isPrefixOk = false
          break
        }
      }
    }

    return {
      isPrefixOk,
      invalidContIdx
    }
  }

  _nextBlock(contStack: string[], skipInitialPrefixCheck: boolean = false): BlockNode {

    const cache = this._getCache()
    if (cache) {
      return cache.node
    }

    const lineInfo = this._nextLine({ 
      contStack,
      skipInitialPrefixCheck
    })    
    if (!lineInfo) {
      // end of raw
      const cac = Array(contStack.length).fill(containerExit)
      if (cac.length) this._storeCache(this._idx, ...cac)
      return containerExit
    }

    const { identNum, isPrefixOk, invalidContIdx, isBlankLine, lineBeginIdx } = lineInfo

    if (isBlankLine) {
      if (!isPrefixOk) {
        // A list item may contain blocks that are separated by more than one blank line
        
        // TODO: indexOf
        // TODO: lastIndexOf?
        let firstArrowIdx = invalidContIdx
        while (firstArrowIdx < contStack.length && contStack[firstArrowIdx] !== '>') {
          firstArrowIdx++
        }
        if (firstArrowIdx < contStack.length) {
          const cac = Array(contStack.length - firstArrowIdx - 1).fill(containerExit)
          
          if(cac.length) this._storeCache(lineBeginIdx, ...cac)
          this._storeCache(this._idx, blankLine)
          this._idx = lineBeginIdx
          return containerExit
        }
      }
      return blankLine
    }
    
    let ret: BlockNode | null = null

    const currContStack = isPrefixOk ? contStack : contStack.slice(0, invalidContIdx)

    const lastBlock = this._lastBlocks[contStack.length]
    const currLastBlock = isPrefixOk ? lastBlock : this._lastBlocks[invalidContIdx]

    const alteredLineInfo: LineInfo = {
      ...lineInfo,
      isPrefixOk: true
    }

    if (identNum < 4) {
      ret = this.parseAtxHeading() ||
            this.parseFencedCode(currContStack) ||
            this.parseBlockquote(alteredLineInfo, currContStack) ||
            this.parseSetextHeading(currLastBlock) || 
            this.parseThematicBreak() ||
            // HACK: marker is a mess (with digits or without digits?)
            // @ts-ignore
            (currLastBlock?.type === NodeType.LIST_ITEM ? this.parseListItem(currLastBlock.marker.slice(-1), lineInfo, currContStack) : null) ||
            this.parseList(alteredLineInfo, currContStack) ||
            this.parseHtml(alteredLineInfo, currContStack) ||
            this.parseParagraph(currContStack, lastBlock?.type === NodeType.POTENTIAL_PARAGRAPH)
    } else {
      if (lastBlock?.type === NodeType.POTENTIAL_PARAGRAPH) {
        this._idx -= identNum
        ret = this.parseParagraph(currContStack, true)
      } else {
        ret = this.parseIndentedCode(alteredLineInfo, currContStack)
      }
    }

    if (isPrefixOk) {
      return ret
    } else {
      if (ret.type === NodeType.PARAGRAPH_CONTINUATION) {
        return ret
      } else {
        if (ret) {
          const exitNum = contStack.length - invalidContIdx - 1
          
          const cac = []
          for (let i = 0; i < exitNum; i++) {
            cac.push(containerExit)
          }
          if (cac.length) this._storeCache_front(lineInfo.lineBeginIdx, ...cac)
          this._storeCache_front(this._idx, ret)
          this._idx = lineInfo.lineBeginIdx
        } else {
          throw new Error('not allowed!')
        }
        return containerExit
      }
    
    }
  }

  parseLinkRef(p: PontentialParagraph): LinkRefDef | null {
    // TODO: may be preceded by up to three spaces of indentation
    const { raw } = p
    let idx = 0

    let ret: LinkRefDef | null = null

    while (idx < raw.length) {
      let refLabel = ''
      let refDest = ''
      let refTitle = ''


      linkRefRules.label.lastIndex = idx
      if (linkRefRules.label.test(raw)) {
        refLabel = raw.slice(idx, linkRefRules.label.lastIndex)
        idx = linkRefRules.label.lastIndex
      } else {
        return null
      }

      // followed by a colon (:), optional spaces or tabs (including up to one line ending)
      if (raw.charAt(idx) === ':') idx++
      else return null

      const seperatorPattern = /[ \t]*\n?[ \t]*/y
      seperatorPattern.lastIndex = idx
      if (seperatorPattern.test(raw)) idx = seperatorPattern.lastIndex

      const destRes = linkRefRules.dest(raw, idx)
      if (destRes.matched) {
        refDest = raw.slice(idx, destRes.idx)
        refDest = restoreBackslashEscapes(refDest)
        idx = destRes.idx
      } else {
        return null
      }

      seperatorPattern.lastIndex = idx
      if (seperatorPattern.test(raw) && seperatorPattern.lastIndex > idx) {
        idx = seperatorPattern.lastIndex

        const titleRes = linkRefRules.title(raw, idx)
        if (titleRes.matched) {
          refTitle = raw.slice(idx, titleRes.idx)
          refTitle = restoreBackslashEscapes(refTitle)
          idx = titleRes.idx
        }
      }

      const lineTailPattern = /[ \t]*(?:\n|$)/y
      lineTailPattern.lastIndex = idx
      if (!lineTailPattern.test(raw)) {
        return null
      }
      idx = lineTailPattern.lastIndex

      const refNode: LinkRefDef = { 
        type: NodeType.LINK_REF_DEF,
        label: refLabel,
        dest: refDest,
        title: refTitle
      }
      if (!ret) {
        ret = refNode
      } else {
        // NOTE: (p.contentBeginIdx + idx) is not accurate. It's only a relative index.
        this._storeCache_front(p.contentBeginIdx + idx, refNode)
      }
      p.raw = raw.slice(idx)
    }

    return ret
  }

  parseHtml(lineInfo: LineInfo, contStack: string[]): HtmlBlock | null {
    // TODO: keep indentation
    const { _raw: raw, _lastBlocks: lastBlocks } = this
    let ruleIdx = htmlBlockRules.findIndex(rule => {
      rule.start.lastIndex = this._idx
      return rule.start.test(raw)
    })
    if (ruleIdx < 0) {
      return null
    }

    if (ruleIdx === 6) {
      const lastBlock = lastBlocks[contStack.length]
      if (lastBlock?.type === NodeType.POTENTIAL_PARAGRAPH) {
        return null
      }
    }

    const ret: HtmlBlock = {
      type: NodeType.HTML_BLOCK,
      raw: ' '.repeat(lineInfo.identNum)
    }

    const lastArrowIndex = contStack.lastIndexOf('>')
    const rule = htmlBlockRules[ruleIdx]
    let l: LineInfo | null = lineInfo

    if (ruleIdx < 5) {
      while (l) {
        const { isPrefixOk, rollbackIdx, invalidContIdx, isBlankLine } = l
        if (!(isPrefixOk || (isBlankLine && invalidContIdx > lastArrowIndex))) {
          this._idx = rollbackIdx
          break
        }
        const beginIdx = this._idx
        this._goToNextLine()
        ret.raw += raw.slice(beginIdx, this._idx)

        rule.end!.lastIndex = beginIdx
        if (rule.end!.test(raw)) {
          break
        }
        l = this._nextLine({ contStack, skipIdentation: false })
      }
    } else {
      while (l) {
        const { isPrefixOk, rollbackIdx, invalidContIdx, isBlankLine } = l
        if (!(isPrefixOk || (isBlankLine && invalidContIdx > lastArrowIndex))) {
          this._idx = rollbackIdx
          break
        }
        if (isBlankLine) {
          this._idx = rollbackIdx
          break
        }
        const beginIdx = this._idx
        this._goToNextLine()
        ret.raw += raw.slice(beginIdx, this._idx)

        l = this._nextLine({ contStack, skipIdentation: false })
      }
    }
    return ret
  }

  parseList(lineInfo: LineInfo, contStack: string[]): List | null {
    // TODO: loose or tight
    const unorderedListMarkerPattern = /([-+*])/y
    const orderedListMarkerPattern = /(\d{1,9})([.)])/y
    const { _raw: raw, _blankLinePattern: blankLinePattern, _lastBlocks: lastBlocks } = this

    let backupIdx = this._idx
    const children = new ChildrenContainer<ListItem>

    unorderedListMarkerPattern.lastIndex = this._idx
    orderedListMarkerPattern.lastIndex = this._idx

    const uListMarkerResult = unorderedListMarkerPattern.exec(raw)
    const oListMarkerResult = orderedListMarkerPattern.exec(raw)

    let ret: List | null = null

    const isLastNodePara = lastBlocks[contStack.length]?.type === NodeType.POTENTIAL_PARAGRAPH

    if (uListMarkerResult) {
      ret = {
        type: NodeType.UNORDERED_LIST,
        loose: false, // TODO
        children,
        // @ts-ignore
        marker: uListMarkerResult[1]
      }

    } else if (oListMarkerResult) {
      const digits = oListMarkerResult[1]
      // when it starts on a line that would otherwise count as paragraph continuation text—then 
      // and the list item is ordered, the start number must be 1.
      if (!(isLastNodePara && digits !== '1')) {
        // @ts-ignore 
        ret = {
          type: NodeType.ORDERED_LIST,
          loose: false,
          children,
          // @ts-ignore
          marker: oListMarkerResult[2],
          startNum: digits
        }
      }
    }

    if (!ret) return null

    // an empty list item cannot interrupt a paragraph
    blankLinePattern.lastIndex = uListMarkerResult ? unorderedListMarkerPattern.lastIndex : orderedListMarkerPattern.lastIndex
    if (isLastNodePara && blankLinePattern.test(raw)) {
      return null
    }
    
    let listItem: ListItem | null = this.parseListItem(ret.marker, lineInfo, contStack)
    if (!listItem) {
      return null
    } else {
      backupIdx = this._idx
      children.pushBack(listItem)
      lastBlocks[contStack.length] = listItem
      ret.loose = listItem.loose
    }

    while (true) {
      const blanks: Record<number, BlockNode> = {}
      let block: BlockNode | null = null
      while ((block = this._nextBlock(contStack)) && block.type === NodeType.BLANK_LINE) {
        blanks[this._idx] = block
      }

      if (block.type === NodeType.LIST_ITEM) {
        // NOTE: blank line is not pushed into children
        backupIdx = this._idx
        children.pushBack(block)
        lastBlocks[contStack.length] = block
        // TODO: remove ts-ignore
        // @ts-ignore
        ret.loose = ret.loose || block.loose || Object.keys(blanks).length > 0
      } else {
        for (const i in blanks) {
          this._storeCache(parseInt(i), blanks[i])
        }
        this._storeCache_front(this._idx, block)
        this._idx = backupIdx
        break
      }
    }

    return ret
  }

  parseListItem(type: ListItemMarker, lineInfo: LineInfo, contStack: string[]): ListItem | null {
    const { _raw: raw, _blankLinePattern: blankLinePattern, _lastBlocks: lastBlocks } = this
    let pattern = null
    let backupIdx = this._idx
    if (type === '+' || type === '-' || type === '*') {
      pattern = new RegExp(`\\${type}`, 'y')
    } else {
      pattern = new RegExp(`\\d{1,9}\\${type}`, 'y')
    }

    const identNum = lineInfo.identNum
    const children = new ChildrenContainer<BlockNode>

    pattern.lastIndex = this._idx
    const patternResult = pattern.exec(raw)

    let isListItemFound = false
    let startsWithBlankLine = false

    if (!patternResult) return null
    //@ts-ignore
    const marker: ListItemMarker = patternResult[0]
    const markerLen = marker.length

    blankLinePattern.lastIndex = pattern.lastIndex
    if (blankLinePattern.test(raw)) {
      // Item starting with a blank line
      contStack.push(" ".repeat(identNum + markerLen + 1))
      this._idx = blankLinePattern.lastIndex
      isListItemFound = true
      startsWithBlankLine = true
    } else {
      this._idx = pattern.lastIndex
      const spaceNum = this._skipIndentation()
      if (spaceNum) {
        isListItemFound = true
        startsWithBlankLine = false
        if (spaceNum <= 4) {
          // Basic case
          contStack.push(" ".repeat(identNum + markerLen + spaceNum))
          // this._idx += markerLen + spaceNum
        } else {
          // Item starting with indented code
          contStack.push(" ".repeat(identNum + markerLen + 1))
          this._idx -= spaceNum - 1
        }
      }
    }

    if (!isListItemFound) {
      this._idx = backupIdx
      return null
    }

    const ret: ListItem = {
      type: NodeType.LIST_ITEM,
      children,
      loose: false, // contain two block-level elements with a blank line between them
      marker
    }  

    lastBlocks[contStack.length - 1] = ret
    lastBlocks[contStack.length] = null

    backupIdx = this._idx
    let block = this._nextBlock(contStack, !startsWithBlankLine)
    if (!(startsWithBlankLine && block.type === NodeType.BLANK_LINE)) {
      while (block.type !== NodeType.CONTAINER_EXIT) {
        children.pushBack(block)
        lastBlocks[contStack.length] = block
        if (block.type === NodeType.BLANK_LINE) ret.loose = true
        block = this._nextBlock(contStack)
      }
    } else {
      this._storeCache_front(this._idx, blankLine)
      this._idx = backupIdx
      ret.loose = false
    }
    
    contStack.pop()

    return ret
  }

  parseAtxHeading(): AtxHeading | null {
    const { _raw: raw } = this
    const atxHeadingPattern = /(#{1,6})[ \t$]+(.*?)(?:[ \t]+#+[ \t]*)?(?:$|\n)/y
    atxHeadingPattern.lastIndex = this._idx
    const atxHeadingPatternResult = atxHeadingPattern.exec(raw)
    if (atxHeadingPatternResult) {
      const level = atxHeadingPatternResult[1].length as AtxHeadingLevel
      const contentRaw = trimParagraph(atxHeadingPatternResult[2])
      // const araw = raw.slice(this._idx, atxHeadingPattern.lastIndex)
      this._idx = atxHeadingPattern.lastIndex
      // console.log(contentRaw)
      return {
        type: NodeType.ATX_HEADING,
        level,
        raw: contentRaw,
        children: new DoublyLinkedList() 
      }
    } else {
      return null
    }
  }

  // TODO: remove lastBlock parameter
  parseSetextHeading(lastBlock: Node | null): BlockNode | null {
    const { _raw: raw } = this

    if (lastBlock?.type !== NodeType.POTENTIAL_PARAGRAPH) {
      return null
    }

    const setextHeadingPattern = /([=-])\1*[ \t]*(?:\n|$)/y
    setextHeadingPattern.lastIndex = this._idx
    const patternResult = setextHeadingPattern.exec(raw)
    if (patternResult) {

      // parse link reference definitions and see whether there's text left
      const refNode = this.parseLinkRef(lastBlock)
      if (refNode && !lastBlock.raw.length) {
        return refNode
      } else {
        const headNode: SetextHeading = {
          type: NodeType.SETEXT_HEADING,
          level: patternResult[1] === '=' ? 1 : 2,
          raw: trimParagraph(lastBlock.raw.slice(0, -1)),
          children: new DoublyLinkedList()
        }
        lastBlock.raw = ''

        if (refNode) {
          this._storeCache_front(setextHeadingPattern.lastIndex, headNode)
          this._idx -= lastBlock.raw.length
          return refNode
        } else {
          this._idx = setextHeadingPattern.lastIndex
          return headNode
        }
      } 
      
    }
    return null
  }

  parseFencedCode(contStack: string[]): FencedCodeBlock | null {
    // TODO: identation
    // TODO: multiple empty lines treated as a single blank line?
    // TODO: empty lines ahead
    // TODO: restore backslash escapes in info string
    const { _raw: raw } = this
    const firstChar = raw.charAt(this._idx)
    const backtickLeadingFencePattern = /(`{3,})[ \t]*([^`]*?)[ \t]*(?:\n|$)/y
    const tildeLeadingFencePattern = /(~{3,})[ \t]*(.*?)[ \t]*(?:\n|$)/y
    if (firstChar === '~' || firstChar === '`') {
      const pattern = firstChar === '~' ? tildeLeadingFencePattern : backtickLeadingFencePattern
      pattern.lastIndex = this._idx
      const patternResult = pattern.exec(raw)
      const lastIndex = pattern.lastIndex
      if (patternResult) {
        const leadingFence = patternResult[1]
        const infoStr = patternResult[2]
        const startIdx = this._idx
        this._idx = lastIndex

        const closingFencePattern = new RegExp(`${firstChar}{${leadingFence.length},}[\t ]*(?:$|\n)`, 'y')

        let craw = ""
        let l = this._nextLine({
          contStack, 
          skipIdentation:false, 
        })
        while (l) {
          const { isPrefixOk, identNum, rollbackIdx, invalidContIdx, isBlankLine } = l
          if (!(isPrefixOk || (isBlankLine && invalidContIdx > contStack.lastIndexOf('>')))) {
            this._idx = rollbackIdx
            break
          }

          const contentBeginIdx = this._idx

          closingFencePattern.lastIndex = this._idx
          if (identNum <= 3 && closingFencePattern.test(raw)) {
            this._goToNextLine()
            break
          }

          if (l.isBlankLine) {
            craw += '\n'.repeat(l.blankLines)
          } else {
            this._goToNextLine()
            craw += raw.slice(contentBeginIdx, this._idx)
          }
          l = this._nextLine({ contStack })
        }
      
        return {
          type: NodeType.CODE_FENCE_BLOCK,
          raw: craw,
        }
      }
    }
    return null
  }

  parseParagraph(contStack: string[], isLastNodePara: boolean): BlockNode {
    const { _raw: raw, _lastBlocks: lastBlocks } = this
    this._paragraphPattern.lastIndex = this._idx
    const result = this._paragraphPattern.exec(raw)
    this._idx = this._paragraphPattern.lastIndex
    // @ts-ignore
    const praw = result[0]
    
    if (isLastNodePara) {
      return {
        type: NodeType.PARAGRAPH_CONTINUATION,
        raw: praw,
      }
    }

    const block: PontentialParagraph = {
      type: NodeType.POTENTIAL_PARAGRAPH,
      raw: praw,
      contentBeginIdx: this._idx - praw.length
    }

    let backupIdx = this._idx
    lastBlocks[contStack.length] = block
    let nextBlk = this._nextBlock(contStack)
    while (nextBlk.type === NodeType.PARAGRAPH_CONTINUATION) {
      block.raw += nextBlk.raw
      backupIdx = this._idx
      lastBlocks[contStack.length] = block
      nextBlk = this._nextBlock(contStack)
    }

    if (block.raw.length) {
      this._storeCache_front(this._idx, nextBlk)  
      this._idx = backupIdx
      return {
        type: NodeType.PARAGRAPH,
        raw: trimParagraph(removeFinalLineBreak(block.raw)),
        children: new DoublyLinkedList()
      }
    } else {
      return nextBlk
    }
    
    
  }

  parseThematicBreak(): ThematicBreak | null {
    const { _raw: raw } = this
    const firstChar = raw.charAt(this._idx)
    if (['_', '*', '-'].includes(firstChar)) {
        
      const thematicBreakPattern = new RegExp(`(?:\\${firstChar}[\t ]*){3,}(?:\n|$)`, 'y')

      thematicBreakPattern.lastIndex = this._idx
      if (thematicBreakPattern.test(raw)) {
        this._idx = thematicBreakPattern.lastIndex
        // const traw = raw.slice(this._idx, thematicBreakPattern.lastIndex)
        return {
          type: NodeType.THEMATIC_BREAK,
          // raw: traw,
        } 
      }
    }
    return null
  }

  parseBlockquote(lineInfo: LineInfo, contStack: string[]): Blockquote | null {
    const { _raw: raw, _lastBlocks: lastBlocks } = this
    const firstChar = raw.charAt(this._idx)

    if (firstChar !== '>') {
      return null
    }

    const list = new ChildrenContainer<BlockNode>()
    const ret: Blockquote = {
      type: NodeType.BLOCKQUOTE,
      children: list
    }
    
    lastBlocks[contStack.length] = ret

    contStack.push('>')

    this._idx++
    if (raw.charAt(this._idx) === ' ') this._idx++
    
    lastBlocks[contStack.length] = null
    let block = this._nextBlock(contStack, true)
    while (block.type !== NodeType.CONTAINER_EXIT) {
      list.pushBack(block)
      lastBlocks[contStack.length] = block
      block = this._nextBlock(contStack)
    }

    contStack.pop()

    return ret
  }

  parseIndentedCode(lineInfo: LineInfo, contStack: string[]): IndentedCodeBlock {
    // TODO: code refactory
    // idented code block cannot interrupt a paragraph
    const { identNum} = lineInfo
    const { _blankLinePattern: blankLinePattern, _raw: raw, _identedCodePattern: identedCodePattern } = this

    let craw = ""
    
    let lf : LineInfo | null = lineInfo
    this._idx -= identNum
    let backupIdx = this._idx

    let lastArrowIndex = contStack.lastIndexOf('>')

    while (true) {

      let blankLines = 0
      let ccraw = ""
      let shouldBreak = false

      while (lf?.isBlankLine) {
        if (lf.isPrefixOk || (lf.invalidContIdx > lastArrowIndex)) {
          blankLines += lf.blankLines
          lf = this._nextLine({
            contStack,
            skipIdentation: false
          })
        } else {
          shouldBreak = true
          this._idx = backupIdx
          break
        }
      }

      // end of raw
      if (!lf) shouldBreak = true

      if (shouldBreak) break

      identedCodePattern.lastIndex = this._idx
      while (lf && !lf.isBlankLine) {
        if (lf.isPrefixOk && identedCodePattern.test(raw)) {
          ccraw += raw.slice(this._idx + 4, this._identedCodePattern.lastIndex)
          this._idx = this._identedCodePattern.lastIndex
          backupIdx = this._idx
          lf = this._nextLine({
            contStack, 
            skipIdentation: false, 
          })
        } else {
          shouldBreak = true
          this._idx = backupIdx
          break
        }
      }
      
      if (ccraw) craw = craw + '\n'.repeat(blankLines) + ccraw
      else {
        this._storeCache(this._idx, blankLine)
        this._idx = backupIdx
        break
      }

      // end of raw
      if (!lf) shouldBreak = true
      if (shouldBreak) break
 
    }
    
    return {
      type: NodeType.INDENTED_CODE_BLOCK,
      raw: craw, // indented code block raw is excluded of leading 4 spaces,
    }
  }

  
  _goToNextLine() {
    const { _raw: raw, _linePattern: linePattern } = this
    linePattern.lastIndex = this._idx
    if (linePattern.test(raw)) {
      this._idx = linePattern.lastIndex
    } else {
      throw new Error('no line feed')
    }
  }

  /**
   * Skips leading spaces
   * @returns the number of identation spaces
   */
  _skipIndentation(max?: number): number {
    const { _raw: raw } = this

    let indentNum = 0
    if (max) {
      while (indentNum < max && this._idx < raw.length && raw.charAt(this._idx) === ' ') {
        this._idx++
        indentNum++
      }
    } else {
      while (this._idx < raw.length && raw.charAt(this._idx) === ' ') {
        this._idx++
        indentNum++
      }
    }
    return indentNum
  }


  


  
}
