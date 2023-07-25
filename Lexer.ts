import { DoublyLinkedList, insertAfter, removeItem } from "./DoublyLinkedList"
import { atxTypes, Node, NodeType } from "./Node"
import createRBTree from 'functional-red-black-tree'

interface CachedBlock {
  nextIdx: number,
  node: Node
}

interface LineInfo {
  identNum: number
  // blankLinesBefore: number,
  // hasBlankLineBefore: boolean,
  // hasEmptyLineBefore: boolean

  invalidContIdx: number
  isPrefixOk: boolean

  lineBeginIdx: number

  rollbackIdx: number
  isBlankLine: boolean
  blankLines: number
}

const containerExit: Node = {
  type: NodeType.CONTAINER_EXIT
}

const blankLine: Node = {
  type: NodeType.BLANK_LINE
}

export class Lexer {
  _raw: string
  _blocks: DoublyLinkedList<Node>
  _idx: number

  // A line containing no characters, or a line containing only spaces (U+0020) or tabs (U+0009), is called a blank line.
  _blankLinePattern = /[ \t]*(?:\n|$)/y
  _paragraphPattern = /.*(?:\n|$)/y
  _identedCodePattern = /     ?.*(?:\n|$)/y
  _linePattern = /.*(?:\n|$)/y


  _cachedBlocks = createRBTree<number, Node[]>()


  constructor(raw: string) {
    this._idx = 0
    this._raw = raw
    this._blocks = new DoublyLinkedList()
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
        it.update(it.value.slice(1))
      }
      return {
        node: ret,
        // @ts-ignore
        nextIdx: it.key
      }
    }
    return null
  }

  _storeCache(key: number, ...items: Node[]) {
    const { _cachedBlocks: cachedBlocks } = this
    const it = cachedBlocks.get(key)
    if (it) {
      throw Error("not allowed")
    } else {
      this._cachedBlocks = cachedBlocks.insert(key, items)
    }
  }

  _storeCache_front(key: number, ...items: Node[]) {
    const { _cachedBlocks: cachedBlocks } = this
    const it = cachedBlocks.get(key)
    if (it) {
      it.unshift(...items)
    } else {
      this._cachedBlocks = cachedBlocks.insert(key, items)
    }
  }

  nextBlock(): Node {
    const cache = this._getCache()
    if (cache) {
      // this._idx = cache.nextIdx
      return cache.node
    } else {
      return this._nextBlock([], null)
    }
  }

  _nextLine({
    contStack = [], 
    skipIdentation = true
  }: {
    contStack?: string[]
    skipIdentation?: boolean
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
    let identNum = this._skipIdentation()

    if (identNum <= 3) {
      // check container prefix
      const checkResult = this._checkPrefix(contStack)
      isPrefixOk = checkResult.isPrefixOk
      invalidContIdx = checkResult.invalidContIdx

      // re-calculate the number of spaces of identation
      identNum = this._skipIdentation()

    } else {
      isPrefixOk = contStack.length ? false : true
    }

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
      this._skipIdentation()
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
    if (contStack.length) {
      for (; invalidContIdx < contStack.length; invalidContIdx++) {
        const cont = contStack[invalidContIdx]
        let shouldContinue = true
        if (cont === '>') {
          if (raw.charAt(this._idx) === '>') {
            this._idx++
            if (raw.charAt(this._idx) === ' ') {
              this._idx++
            }
          } else {
            shouldContinue = false
          }
        } else {
          throw new Error(`${cont} container is currently not supported`)
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

  _nextBlock(contStack: string[], lastBlock: Node | null): Node {
    const { 
      _cachedBlocks: cachedBlocks
    } = this

    // console.log(this._idx)
    const cache = this._getCache()
    if (cache) {
      // this._idx = cache.nextIdx
      return cache.node
    }

    const lineInfo = this._nextLine({ 
      contStack,
    })    
    if (!lineInfo) {
      const cac = []
      for (let i = 0; i < contStack.length; i++) {
        cac.push(containerExit)
      }
      if (cac.length) this._storeCache(this._idx, ...cac)
      return containerExit
    }
    const { identNum, isPrefixOk, invalidContIdx, isBlankLine } = lineInfo


    if (isBlankLine) {
      if (!isPrefixOk) {
        const exitNum = contStack.length - invalidContIdx - 1
        for (let i = 0; i < exitNum; i++) {
          this._storeCache(this._idx, containerExit)
        }
        return containerExit
      } else {
        return blankLine
      }
    }
    
    let ret: Node | null = null

    const currContStack = isPrefixOk ? contStack : contStack.slice(0, invalidContIdx)

    const currLastBlock = isPrefixOk ? lastBlock : null

    const alteredLineInfo: LineInfo = {
      ...lineInfo,
      isPrefixOk: true
    }

    if (identNum < 4) {
      ret = this.parseAtxHeading() ||
            this.parseFencedCode(currContStack) ||
            this.parseBlockquote(alteredLineInfo, currContStack) ||
            this.parseSetextHeading(alteredLineInfo, currContStack, currLastBlock) || 
            this.parseThematicBreak() ||
            this.parseParagraph(alteredLineInfo, currContStack, currLastBlock)
    } else {
      if (currLastBlock?.type === NodeType.POTENTIAL_PARAGRAPH) {
        this._idx -= identNum
        ret = this.parseParagraph(alteredLineInfo, currContStack, currLastBlock)
      } else {
        ret = this.parseIdentedCode(alteredLineInfo, currContStack)
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
        } else {
          throw new Error('not allowed!')
        }
        return containerExit
      }
    
    }
  }

  parseAtxHeading(): Node | null {
    const { _raw: raw } = this
    const atxHeadingPattern = /(#{1,6})[ \t$]+(.*?)(?:[ \t]+#+[ \t]*)?(?:$|\n)/y
    atxHeadingPattern.lastIndex = this._idx
    const atxHeadingPatternResult = atxHeadingPattern.exec(raw)
    if (atxHeadingPatternResult) {
      const type = atxTypes[(atxHeadingPatternResult[1].length - 1)]
      const contentRaw = atxHeadingPatternResult[2].replace(/^[\t ]|[\t g]$/g, '')
      const araw = raw.slice(this._idx, atxHeadingPattern.lastIndex)
      this._idx = atxHeadingPattern.lastIndex
      // console.log(contentRaw)
      return {
        type,
        raw: araw,
        // children: null 
      }
    } else {
      return null
    }
  }

  parseSetextHeading(lineInfo: LineInfo, contStack: string[], lastBlock: Node | null): Node | null {
    const { isPrefixOk } = lineInfo
    const { _raw: raw } = this

    if (lastBlock?.type !== NodeType.POTENTIAL_PARAGRAPH) {
      return null
    }

    const setextHeadingPattern = /([=-])\1*[ \t]*(?:\n|$)/y
    setextHeadingPattern.lastIndex = this._idx
    const patternResult = setextHeadingPattern.exec(raw)
    if (patternResult) {
      if (patternResult[1] === '=') {
        lastBlock.type = NodeType.SETEXT_H1
      } else {
        lastBlock.type = NodeType.SETEXT_H2
      }
      lastBlock.raw += patternResult[0]
      this._idx = setextHeadingPattern.lastIndex
      return this._nextBlock(contStack, lastBlock)
    }
    return null
  }

  parseFencedCode(contStack: string[]): Node | null {
    // TODO: identation
    // TODO: multiple empty lines treated as a single blank line?
    // TODO: empty lines ahead
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

        // const closingFencePattern = new RegExp(`^ {0,3}${firstChar}{${leadingFence.length},}[\t ]*$`, 'gm')
        const closingFencePattern = new RegExp(`${firstChar}{${leadingFence.length},}[\t ]*(?:$|\n)`, 'y')

        let craw = ""
        let l = this._nextLine({
          contStack, 
          skipIdentation:false, 
        })
        while (l) {
          const { isPrefixOk, identNum, rollbackIdx, blankLines } = l
          if (!isPrefixOk) {
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

  parseParagraph(lineInfo: LineInfo, contStack: string[], lastBlock: Node | null): Node {
    const { _raw: raw } = this
    this._paragraphPattern.lastIndex = this._idx
    const result = this._paragraphPattern.exec(raw)
    this._idx = this._paragraphPattern.lastIndex
    // @ts-ignore
    const praw = result[0]
    
    if (lastBlock?.type === NodeType.POTENTIAL_PARAGRAPH) {
      return {
        type: NodeType.PARAGRAPH_CONTINUATION,
        raw: praw,
        // children: null
      }
    }

    const block = {
      type: NodeType.POTENTIAL_PARAGRAPH,
      raw: praw,
      // children: null
    }

    let backupIdx = this._idx
    let nextBlk = this._nextBlock(contStack, block)
    while (nextBlk.type === NodeType.PARAGRAPH_CONTINUATION) {
      block.raw += nextBlk.raw
      backupIdx = this._idx
      nextBlk = this._nextBlock(contStack, block)
    }

    // if the block is not turned into a setext heading
    if (block.type === NodeType.POTENTIAL_PARAGRAPH) {
      block.type = NodeType.PARAGRAPH
    }
 
    this._storeCache_front(this._idx, nextBlk)  
    this._idx = backupIdx

    return block
  }

  parseThematicBreak(): Node | null {
    const { _raw: raw } = this
    const firstChar = raw.charAt(this._idx)
    if (['_', '*', '-'].includes(firstChar)) {
        
      const thematicBreakPattern = new RegExp(`(?:\\${firstChar}[\t ]*){3,}(?:\n|$)`, 'y')

      thematicBreakPattern.lastIndex = this._idx
      if (thematicBreakPattern.test(raw)) {
        this._idx = thematicBreakPattern.lastIndex
        const traw = raw.slice(this._idx, thematicBreakPattern.lastIndex)
        return {
          type: NodeType.THEMATIC_BREAK,
          raw: traw,
        } 
      }
    }
    return null
  }

  parseBlockquote(lineInfo: LineInfo, contStack: string[]): Node | null {
    // TODO: #239 A block quote can be empty
    const { _raw: raw } = this
    const firstChar = raw.charAt(this._idx)

    if (firstChar !== '>') {
      return null
    }

    contStack.push('>')

    // TODO: avoid repeated prefix checks
    this._idx = lineInfo.lineBeginIdx
    
    const list = new DoublyLinkedList<Node>()
    let block = this._nextBlock(contStack, null)
    while (block.type !== NodeType.CONTAINER_EXIT) {
      list.pushBack(block)
      block = this._nextBlock(contStack, block)
    }

    contStack.pop()

    return {
        type: NodeType.BLOCKQUOTE,
        // TODO: raw
        children: list
      }
  }

  parseIdentedCode(lineInfo: LineInfo, contStack: string[]) {
    // idented code block cannot interrupt a paragraph
    const { identNum} = lineInfo
    const { _blankLinePattern: blankLinePattern, _raw: raw, _identedCodePattern: identedCodePattern } = this

    let craw = ""
    
    let lf : LineInfo | null = lineInfo
    this._idx -= identNum
    let backupIdx = this._idx

    // console.log(this._idx)

    // TODO: regex-free optimization
    while (true) {

      let blanks = ""
      let ccraw = ""
      blankLinePattern.lastIndex = this._idx

      if (lf.isBlankLine) {
        blanks += '\n'.repeat(lf.blankLines)
        lf = this._nextLine({
          contStack,
          skipIdentation: false
        })
      }

      if (!lf) {
        // end of raw
        break
      }

      if (!lf.isPrefixOk) {
        this._idx = backupIdx
        break
      }


      identedCodePattern.lastIndex = this._idx
      while (lf?.isPrefixOk && !lf.isBlankLine && identedCodePattern.test(raw)) {
        ccraw += raw.slice(this._idx + 4, this._identedCodePattern.lastIndex)
        this._idx = this._identedCodePattern.lastIndex
        backupIdx = this._idx
        lf = this._nextLine({
          contStack, 
          skipIdentation: false, 
        })
      }

      if (ccraw) {
        craw = craw + blanks + ccraw
      } else {
        break
      }

      if (!lf) {
        // end of raw
        break
      }

      if (!lf.isPrefixOk) {
        this._idx = backupIdx
        break
      }

    }
    
    return {
      type: NodeType.IDENTED_CODE_BLOCK,
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
  _skipIdentation(): number {
    const { _raw: raw } = this
    const oldIdx = this._idx
    while (this._idx < raw.length && raw.charAt(this._idx) === ' ') {
      this._idx++
    }
    let identNum = this._idx - oldIdx
    return identNum
  }
}
