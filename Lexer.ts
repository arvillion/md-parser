import { DoublyLinkedList } from "./DoublyLinkedList"
import { atxTypes, Node, NodeType } from "./Node"

interface CachedBlock {
  nextIdx: number,
  node: Node
}

interface LineInfo {
  identNum: number
  blankLinesBefore: number,
  hasBlankLineBefore: boolean,
  hasEmptyLineBefore: boolean

  invalidContIdx: number
  isPrefixOk: boolean

  lineBeginIdx: number

  rollbackIdx: number
}

const containerExit: Node = {
  type: NodeType.CONTAINER_EXIT
}

const placeholder: Node = {
  type: NodeType.UNKNOWN
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

  _lastBlock: Node | null = null

  _cachedBlocks: CachedBlock[] = []

  constructor(raw: string) {
    this._idx = 0
    this._raw = raw
    this._blocks = new DoublyLinkedList()
  }

  nextBlock(): Node {
    let block: Node | null = null
    const { _cachedBlocks: cachedBlocks } = this

    const cache = cachedBlocks.shift()
    if (cache) {
      this._idx = cache.nextIdx
      block = cache.node
    } else {
      block = this._nextBlock([])
    }

    this._lastBlock = block
    return block
  }

  _nextLine({
    contStack = [], 
    skipIdentation = true, 
    skipBlankLines = true,
    skipEmptyLines = false
  }: {
    contStack?: string[]
    skipIdentation?: boolean
    skipBlankLines?: boolean
    skipEmptyLines?: boolean
  } = {}): LineInfo | null {
    // check whether the line prefix conforms the rules of current containers

    const { 
      _raw: raw,
      _blankLinePattern: blankLinePattern
    } = this

    let hasBlankLineBefore = false
    let hasEmptyLineBefore = false
    let invalidContIdx = 0
    let isPrefixOk = true
    let blankLinesBefore = 0
    const rollbackIdx = this._idx

    // skip blank lines
    if (skipBlankLines) {
      blankLinePattern.lastIndex = this._idx
      while (this._idx < raw.length && blankLinePattern.test(raw)) {
        this._idx = blankLinePattern.lastIndex
        blankLinesBefore++
        hasBlankLineBefore = true
      }
    }

    if (this._idx >= raw.length) {
      return null
    }

    let lineBeginIdx = this._idx

    let identNum = this._skipIdentation()

    if (identNum <= 3) {
      // check container prefix
      const checkResult = this._checkPrefix(contStack)
      isPrefixOk = checkResult.isPrefixOk
      invalidContIdx = checkResult.invalidContIdx

      const currContStack = isPrefixOk ? contStack : contStack.slice(0, invalidContIdx)

      if (skipEmptyLines) {

        blankLinePattern.lastIndex = this._idx
        let isPrefixAlwaysOk = true
        while (this._idx < raw.length && blankLinePattern.test(raw)) {
          hasEmptyLineBefore = true
          this._idx = blankLinePattern.lastIndex
          const backupIdx = this._idx
          // TODO: not <= 3
          if (!(this._skipIdentation() <= 3 && this._checkPrefix(currContStack))) {
            this._idx = backupIdx
            isPrefixAlwaysOk = false
            break
          }
          blankLinePattern.lastIndex = this._idx
          lineBeginIdx = this._idx
        }

        if (!isPrefixAlwaysOk) {
          return null
        }

        if (this._idx >= raw.length) {
          return null
        }

      }

      // re-calculate the number of spaces of identation
      identNum = this._skipIdentation()

    } else {
      isPrefixOk = contStack.length ? false : true
    }

    if (!skipIdentation) {
      this._idx -= identNum
    }

    return {
      identNum,
      hasBlankLineBefore,
      blankLinesBefore,
      hasEmptyLineBefore,

      invalidContIdx,
      isPrefixOk,

      lineBeginIdx,

      rollbackIdx
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

  _nextBlock(contStack: string[]): Node {
    const { 
      _cachedBlocks: cachedBlocks
    } = this

    // console.log(this._idx)

    if (cachedBlocks.length && cachedBlocks[0].node.type !== NodeType.UNKNOWN) {
      // @ts-ignore
      const cache: CachedBlock = cachedBlocks.shift()
      this._idx = cache.nextIdx
      return cache.node
    }

    const lineInfo = this._nextLine({ 
      contStack,
      skipEmptyLines: true
    })
    // console.log(lineInfo, contStack)
    
    if (!lineInfo) {
      return containerExit
    }

    const { identNum, isPrefixOk, invalidContIdx, hasBlankLineBefore, rollbackIdx, hasEmptyLineBefore } = lineInfo

    // if (!isPrefixOk && (hasEmptyLineBefore || hasBlankLineBefore)) {
    //   const exitNum = contStack.length - invalidContIdx - 1
    //   for (let i = 0; i < exitNum; i++) {
    //     cachedBlocks.push({
    //       node: containerExit,
    //       nextIdx: this._idx
    //     })
    //   }
    //   this._idx = rollbackIdx
    //   return containerExit
    // }
    
    let ret: Node | null = null

    const currContStack = isPrefixOk ? contStack : contStack.slice(0, invalidContIdx)

    const alteredLineInfo: LineInfo = {
      ...lineInfo,
      isPrefixOk: true
    }

    if (identNum < 4) {
      ret = this.parseAtxHeading() ||
            this.parseFencedCode(currContStack) ||
            this.parseBlockquote(alteredLineInfo, currContStack) ||
            this.parseSetextHeading(alteredLineInfo, currContStack) || 
            this.parseThematicBreak() ||
            this.parseParagraph(alteredLineInfo, currContStack)
    } else {
      if (!hasBlankLineBefore && this._lastBlock?.type === NodeType.POTENTIAL_PARAGRAPH) {
        this._idx -= identNum
        ret = this.parseParagraph(alteredLineInfo, currContStack)
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
          for (let i = 0; i < exitNum; i++) {
            cachedBlocks.push({
              node: containerExit,
              nextIdx: this._idx
            })
          }
          cachedBlocks.push({
            node: ret,
            nextIdx: this._idx
          })
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

  parseSetextHeading(lineInfo: LineInfo, contStack: string[]): Node | null {
    const { hasBlankLineBefore, isPrefixOk } = lineInfo
    const { _raw: raw, _lastBlock: lastBlock } = this

    if (!isPrefixOk || hasBlankLineBefore || lastBlock?.type !== NodeType.POTENTIAL_PARAGRAPH) {
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
      return this._nextBlock(contStack)
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
          skipBlankLines: false
        })
        while (l) {
          const { isPrefixOk, identNum, rollbackIdx } = l
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

          this._goToNextLine()
          craw += raw.slice(contentBeginIdx, this._idx)
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

  parseParagraph(lineInfo: LineInfo, contStack: string[]): Node {
    const { _raw: raw, _lastBlock: lastBlock, _cachedBlocks: cachedBlocks } = this
    const { hasBlankLineBefore } = lineInfo
    this._paragraphPattern.lastIndex = this._idx
    const result = this._paragraphPattern.exec(raw)
    this._idx = this._paragraphPattern.lastIndex
    // @ts-ignore
    const praw = result[0]
    
    if (!hasBlankLineBefore && lastBlock?.type === NodeType.POTENTIAL_PARAGRAPH) {
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
    this._lastBlock = block

    const pl = {
      node: placeholder,
      nextIdx: -1
    }
    cachedBlocks.push(pl)

    let nextBlk = this._nextBlock(contStack)
    while (nextBlk.type === NodeType.PARAGRAPH_CONTINUATION) {
      block.raw += nextBlk.raw
      nextBlk = this._nextBlock(contStack)
    }

    // if the block is not turned into a setext heading
    if (block.type === NodeType.POTENTIAL_PARAGRAPH) {
      block.type = NodeType.PARAGRAPH
    }

    // cachedBlocks.push({
    //   node: nextBlk,
    //   nextIdx: this._idx 
    // })
    pl.node = nextBlk
    pl.nextIdx = this._idx    

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
    let block = this._nextBlock(contStack)
    while (block.type !== NodeType.CONTAINER_EXIT) {
      list.append(block)
      block = this._nextBlock(contStack)
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
    const { hasBlankLineBefore, identNum} = lineInfo
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
      while (lf?.isPrefixOk && this._idx < raw.length && blankLinePattern.test(raw)) {
        blanks += '\n'
        this._idx = blankLinePattern.lastIndex
        lf = this._nextLine({
          contStack, 
          skipIdentation: false, 
          skipBlankLines: false
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
      while (lf?.isPrefixOk && identedCodePattern.test(raw)) {
        ccraw += raw.slice(this._idx + 4, this._identedCodePattern.lastIndex)
        this._idx = this._identedCodePattern.lastIndex
        backupIdx = this._idx
        lf = this._nextLine({
          contStack, 
          skipIdentation: false, 
          skipBlankLines: false
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
