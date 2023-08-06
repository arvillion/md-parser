import { NodeType, ChildrenContainer, InlineNode, Text, Link, Image, LinkType, ImageType } from "./Node"
import { autoLinkRule, htmlInlineRule } from './rules'
import { DoublyLinkedList, DoublyLinkedListItem, removeItem } from "./DoublyLinkedList"

type BracketDelimType = '[' | '!['
type EmphasisDelimType = '*' | '_'
// type DelimType = BracketDelim | EmphasisDelim

interface BracketDelim {
  type: BracketDelimType
  idx: number
  textNode: DoublyLinkedListItem<Text>
  active: boolean
}

interface EmphasisDelim {
  type: EmphasisDelimType
  idx: number
  textNode: DoublyLinkedListItem<Text>
  length: number
  // TODO
}

type Delimiter = BracketDelim | EmphasisDelim

interface Ref {
  title?: string
  dest: string
}

function skipRepeat(raw: string, idx: number) {
  const ch = raw.charAt(idx)
  idx++
  while (idx < raw.length && raw.charAt(idx) === ch) idx++
  return idx
}

// skip spaces, tabs, and up to one line ending
function skipBlank(raw: string, idx: number) {
  let allowLineBreak = true
  while (idx < raw.length) {
    const ch = raw.charAt(idx)
    if (ch === ' ' || ch === '\t') continue
    if (ch === '\n' && allowLineBreak) {
      allowLineBreak = false
      continue
    }
    break 
  }
  return idx
}

function normalizeLabel(label: string) {
  // Unicode case fold
  label = label.toLowerCase()
  
  // Strip leading and trailing spaces, tabs, and line endings
  label = label.replace(/^[ \t\n]+|[ \t\n]+$/g, '')
  
  // Collapse consecutive internal spaces, tabs, and line endings to a single space
  label = label.replace(/[ \t\n]+/g, ' ')
  
  return label
}

function processCodeSpanRaw(raw: string) {
  raw = raw.replace(/\n/g, ' ')
  return (raw.startsWith(' ') && raw.endsWith(' ') && !/^ +$/.test(raw)) 
          ? raw.slice(1, -1) : raw
}

export function parseInlines(raw: string, refMap: Record<string, Ref>): ChildrenContainer<InlineNode>  {
  // type DelimStack = DoublyLinkedList<Delimiter>
  // type DelimStackItem = DoublyLinkedListItem<Delimiter>

  if (raw.endsWith('\n')) raw = raw.slice(0, -1)

  let idx = 0
  let chBefore = ''

  const nodeList = new DoublyLinkedList<InlineNode>
  const delimStack = new DoublyLinkedList<Delimiter>

  let textBeginIdx = 0

  const flushText = () => {
    if (textBeginIdx < idx) {
      nodeList.pushBack({
        type: NodeType.TEXT,
        raw: raw.slice(textBeginIdx, idx)
      })
    }
  }

  const insertBracketDelim = (type: BracketDelimType, idx: number) => {
    const textNode = nodeList.pushBack({
      type: NodeType.TEXT,
      raw: type
    }) as DoublyLinkedListItem<Text>
    const delimItem = delimStack.pushBack({
      type,
      textNode,
      active: true,
      idx
    })
    return delimItem
  }

  const insertEmphasisDelim = (type: EmphasisDelimType, length: number, idx: number) => {
    const textNode = nodeList.pushBack({
      type: NodeType.TEXT,
      raw: type.repeat(length)
    }) as DoublyLinkedListItem<Text>
    const delimItem = delimStack.pushBack({
      type,
      textNode,
      length,
      idx
    })
    return delimItem
  }

  // log the begining position of backticks runs in advance
  const backtickRunPos :Record<number, number[]> = []
  const backtickRunPattern = /(?<!\\)``*/g
  idx = 0
  while (idx < raw.length) {
    let patternRes: any = null
    while (patternRes = backtickRunPattern.exec(raw)) {
      const backtickRunLen = patternRes[0].length
      if (backtickRunPos[backtickRunLen]) {
        backtickRunPos[backtickRunLen].push(patternRes.index)
      } else {
        backtickRunPos[backtickRunLen] = [patternRes.index]
      }
    }
  }

  chBefore = raw.charAt(0)
  const unescapedBracketNum: number[] = [(chBefore === '[' || chBefore === ']') ? 1 : 0]
  idx = 1
  while (idx < raw.length) {
    const ch = raw.charAt(idx)
    unescapedBracketNum[idx] = (chBefore !== '\\' && (ch === '[' || ch === ']'))
      ? unescapedBracketNum[idx - 1] + 1
      : unescapedBracketNum[idx - 1]
    chBefore = ch
    idx++
  }

  
  const bracketStack: DoublyLinkedListItem<BracketDelim>[] = []
  idx = 0
  chBefore = ''

  while (idx < raw.length) {
    const ch = raw.charAt(idx)
    if (chBefore !== '\\') {
      if (ch === '`') {
        const nextIdx = skipRepeat(raw, idx)
        const backtickLen = nextIdx - idx
        const posArr = backtickRunPos[backtickLen]
        let posArrIdx = 0

        while (posArrIdx < posArr.length && posArr[posArrIdx] <= idx) posArrIdx++
        
        if (posArrIdx < posArr.length) {
          flushText()

          nodeList.pushBack({
            type: NodeType.CODE_SPAN,
            raw: processCodeSpanRaw(raw.slice(idx + backtickLen, posArr[posArrIdx]))
          })

          idx = posArr[posArrIdx] + backtickLen
          textBeginIdx = idx
          backtickRunPos[backtickLen] = posArr.slice(posArrIdx + 1)
          continue
        } else {
          backtickRunPos[backtickLen] = []
        }

      } else if (ch === '<') {
        autoLinkRule.lastIndex = idx
        const ruleRes = autoLinkRule.exec(raw)
        if (ruleRes) {
          // auto link
          flushText()
          const label = ruleRes[0].slice(1, -1)
          const link = ruleRes[1] ? ruleRes[1] : 'mailto:' + ruleRes[2]
          
          nodeList.pushBack({
            type: NodeType.AUTO_LINK,
            label,
            link
          })
          idx = autoLinkRule.lastIndex
          textBeginIdx = idx
          continue
        }

        htmlInlineRule.lastIndex = idx
        if (htmlInlineRule.test(raw)) {
          // inline html
          flushText()
          
          nodeList.pushBack({
            type: NodeType.HTML_INLINE,
            raw: raw.slice(idx, htmlInlineRule.lastIndex)
          })

          idx = htmlInlineRule.lastIndex
          textBeginIdx = idx
          continue
        }
      } else if (ch === '[') {
        flushText()
        const delimItem = insertBracketDelim('[', idx)
        bracketStack.push(delimItem as DoublyLinkedListItem<BracketDelim>)
        idx++
        textBeginIdx = idx
        continue
      } else if (raw.startsWith('![', idx)) {
        flushText()
        const delimItem = insertBracketDelim('![', idx)
        bracketStack.push(delimItem as DoublyLinkedListItem<BracketDelim>)
        idx += 2
        textBeginIdx = idx
        continue
      } else if (ch === ']' && bracketStack.length) {
        const leftDim = bracketStack.pop() as DoublyLinkedListItem<BracketDelim>
        
        if (!leftDim.item.active) {
          removeItem(leftDim)
        } else {
          const isImageDim = leftDim.item.type === '!['
          
          // here "link" refers to a more general concept, including both link and image
          let linkType: LinkType | ImageType | undefined = undefined
          let linkDest: string | undefined = undefined
          let linkTitle: string | undefined = undefined
          let linkLabel: string | undefined = undefined
          let nextIdx: number | undefined = undefined
          
          const cha = raw.charAt(idx + 1)
          if (cha === '(') {
            // try to parse inline links
            
            // link destination 
            let iidx = skipBlank(raw, idx + 2)
            let chBefore = raw.charAt(iidx - 1)
            let beginIdx = iidx

            if (raw.charAt(iidx) === '<') {
              iidx++
              // contains no line endings or unescaped < or > characters
              while (iidx < raw.length) {
                const ch = raw.charAt(iidx)
                if (ch === '\n') break
                if (chBefore !== '\\') {
                  if (ch === '<') break
                  if (ch === '>') {
                    linkDest = raw.slice(beginIdx + 1, iidx)
                    break
                  }
                }
                iidx++
                chBefore = ch
              }

              if (linkDest) iidx++
              else iidx = beginIdx // fail

            } else {
              const parStack: string[] = []
              while (iidx < raw.length) {
                const ch = raw.charAt(iidx)
                const chCode = raw.charCodeAt(iidx)
                // does not include ASCII control characters or space character
                if (ch === ' ' || chCode <= 31 || chCode === 127) break
                if (chBefore !== '\\') {
                  if (ch === '(') parStack.push('(')
                  else if (ch === ')') {
                    if (parStack.length) parStack.pop()
                    else {
                      break
                    }
                  }
                }
                iidx++
                chBefore = ch
              }
              if (!parStack.length && iidx > beginIdx) {
                // nonempty sequence of characters and balanced parentheses
                linkDest = raw.slice(beginIdx, iidx)
              } else {
                // fail
                iidx = beginIdx
              }
            }

            beginIdx = iidx
            iidx = skipBlank(raw, iidx)
            // link title
            if (iidx > beginIdx && linkDest) {
              const marker = raw.charAt(iidx)
              const markerIdx = iidx
              if (marker === '"' || marker === "'") {
                iidx++
                chBefore = raw.charAt(iidx - 1)
                while (iidx < raw.length) {
                  const ch = raw.charAt(iidx)
                  if (chBefore !== '\\' && ch === marker) {
                    linkTitle = raw.slice(markerIdx + 1, iidx)
                    break
                  }
                  iidx++
                  chBefore = ch
                }
              } else if (marker === '(') {
                iidx++
                chBefore = raw.charAt(iidx - 1)
                while (iidx < raw.length) {
                  const ch = raw.charAt(iidx)
                  if (chBefore !== '\\') {
                    if (ch === '(') break
                    if (ch === ')') {
                      linkTitle = raw.slice(markerIdx + 1, iidx)
                      break
                    }
                  }
                  iidx++
                  chBefore = ch
                }
              }
              
              if (linkTitle) {
                iidx++
                iidx = skipBlank(raw, iidx)
              } else {
                iidx = beginIdx
              }
            }

            if (raw.charAt(iidx) === ')') {
              // has an inline link
              linkType = isImageDim ? NodeType.INLINE_IMAGE : NodeType.INLINE_LINK
              nextIdx = iidx + 1
            }
          } else if (cha === '[') {
            // try to parse a full reference link
            let iidx = idx + 2
            const beginIdx = iidx
            let chBefore = cha
            let isBlank = true
            let closeBracketFound = false

            // TODO: A link label can have at most 999 characters inside the square brackets.
            while (iidx < raw.length) {
              const ch = raw.charAt(iidx)
              // there must be at least one character that is not a space, tab, or line ending
              if (![' ', '\t', '\n'].includes(ch)) {
                isBlank = false
              }
              if (chBefore !== '\\') {
                if (ch === '[') {
                  break
                } else if (ch === ']') {
                  closeBracketFound = true
                  break
                }
              }
              chBefore = ch
              iidx++
            }

            if (closeBracketFound && !isBlank) {
              const normalizedLabel = normalizeLabel(raw.slice(beginIdx, iidx))
              if (refMap[normalizedLabel]) {
                // full ref link
                linkLabel = normalizedLabel
                linkType = isImageDim ? NodeType.FULL_REF_IMAGE : NodeType.FULL_REF_LINK
                nextIdx = iidx + 1
              }
            }
            
          }


          if (!linkType) {
            // try to parse a collapsed ref link or a shortcut ref link
            const labelContainUnescBrackets = isImageDim && (unescapedBracketNum[idx] - unescapedBracketNum[leftDim.item.idx] > 2)
            if (!labelContainUnescBrackets) {
              const normalizedLabel = normalizeLabel(raw.slice(isImageDim ? leftDim.item.idx + 2 : leftDim.item.idx + 1, idx))
              if (refMap[normalizedLabel]) {
                linkLabel = normalizedLabel
                if (raw.startsWith('[]', idx + 1)) {
                  // collapsed ref link
                  linkType = isImageDim ? NodeType.COLLAPSED_REF_IMAGE : NodeType.COLLAPSED_REF_LINK
                  nextIdx = idx + 2
                } else {
                  linkType = isImageDim ? NodeType.SHORTCUT_REF_IMAGE : NodeType.SHORTCUT_REF_LINK
                  nextIdx = idx + 1
                }
              }
            }
          }

          if (linkType) {
            // If we have a link (and not an image), we also set all [ delimiters before the opening delimiter to inactive.
            if (!isImageDim) {
              // TODO: optimize
              let i = leftDim
              while (i != delimStack._head) {
                if (i.item.type === '[') {
                  i.item.active = false
                }
                i = i.last
              }
            }
            const delimsBetween = delimStack.slice(leftDim.next, delimStack._tail)
            removeItem(leftDim)

            flushText()
            const inlinesBetween = nodeList.slice(leftDim.item.textNode.next, nodeList._tail)
            removeItem(leftDim.item.textNode)

              
            if (linkLabel) {
              nodeList.pushBack({
                type: linkType,
                children: inlinesBetween, // TODO
                label: linkLabel
              })
            } else {
              // @ts-ignore
              nodeList.pushBack({
                type: linkType,
                dest: linkDest,
                title: linkTitle,
                children: inlinesBetween // TODO
              })
            }
            // @ts-ignore
            idx = nextIdx
            textBeginIdx = idx
            continue
          }
    
        }
      } else if (ch === '_' || ch === '*') {
        // const iidx = this._skipRepeat(raw, idx)
        // const delimItem = insertDelim(ch, raw.slice(idx, iidx))
        // idx = iidx
        // textBeginIdx = iidx
      } 
    } else {
      idx++
    }


    idx++
    chBefore = ch
  }

  flushText()

  return nodeList
}

// TODO
function processEmphasis() {
  
}