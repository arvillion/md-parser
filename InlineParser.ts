import { NodeType, ChildrenContainer, InlineNode, Text, Link, Image, LinkType, ImageType, Emphasis, StrongEmphasis } from "./types"
import { autoLinkRule, htmlInlineRule } from './rules'
import { DoublyLinkedList, DoublyLinkedListItem, insertAfter, removeItem } from "./DoublyLinkedList"
import { ASCIIpunctuations, getEmphasisDelimiterEffect, restoreBackslashEscapes } from "./utils"

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
  modLength: number // length modulo 3
  canOpen: boolean
  canClose: boolean
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
    if (ch === ' ' || ch === '\t') {
      idx++
      continue
    }
    if (ch === '\n' && allowLineBreak) {
      allowLineBreak = false
      idx++
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

export function parseInlines(raw: string, refMap: Record<string, Ref>, container: DoublyLinkedList<InlineNode>): ChildrenContainer<InlineNode>  {
  if (raw.endsWith('\n')) raw = raw.slice(0, -1)

  let idx = 0
  let chBefore = ''

  const nodeList = container
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

  const insertEmphasisDelim = (type: EmphasisDelimType, length: number, idx: number, canOpen: boolean, canClose: boolean) => {
    const textNode = nodeList.pushBack({
      type: NodeType.TEXT,
      raw: type.repeat(length)
    }) as DoublyLinkedListItem<Text>
    const delimItem = delimStack.pushBack({
      type,
      textNode,
      length,
      modLength: length % 3,
      idx,
      canOpen,
      canClose
    })
    return delimItem
  }

  // log the begining position of backticks runs in advance
  const backtickRunPos :Record<number, number[]> = []
  const backtickRunPattern = /`+/g

  let patternRes: any = null
  while (patternRes = backtickRunPattern.exec(raw)) {
    const backtickRunLen = patternRes[0].length
    if (backtickRunPos[backtickRunLen]) {
      backtickRunPos[backtickRunLen].push(patternRes.index)
    } else {
      backtickRunPos[backtickRunLen] = [patternRes.index]
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
  textBeginIdx = 0
  chBefore = ''

  let consecutiveSpaceNum = 0

  while (idx < raw.length) {
    const ch = raw.charAt(idx)
    let normal = true
    if (chBefore === '\\') {
      if (ASCIIpunctuations.includes(ch)) {
        idx--
        flushText()

        idx++
        textBeginIdx = idx
      }
    } else {
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
        } else {
          idx += backtickLen
          backtickRunPos[backtickLen] = []
        }
        normal = false

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
          normal = false
        } else {
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
            normal = false
          }
        }
      } else if (ch === '[') {
        flushText()
        const delimItem = insertBracketDelim('[', idx)
        bracketStack.push(delimItem as DoublyLinkedListItem<BracketDelim>)
        idx++
        textBeginIdx = idx
        normal = false
      } else if (raw.startsWith('![', idx)) {
        flushText()
        const delimItem = insertBracketDelim('![', idx)
        bracketStack.push(delimItem as DoublyLinkedListItem<BracketDelim>)
        idx += 2
        textBeginIdx = idx
        normal = false
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
                    linkDest = restoreBackslashEscapes(linkDest)
                    break
                  }
                }
                iidx++
                chBefore = ch
              }

              if (linkDest !== undefined) iidx++
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
                linkDest = restoreBackslashEscapes(linkDest)

              } else {
                // fail
                iidx = beginIdx
              }
            }

            beginIdx = iidx
            iidx = skipBlank(raw, iidx)
            // link title
            if (iidx > beginIdx && linkDest !== undefined) {
              const marker = raw.charAt(iidx)
              const markerIdx = iidx
              if (marker === '"' || marker === "'") {
                iidx++
                chBefore = raw.charAt(iidx - 1)
                while (iidx < raw.length) {
                  const ch = raw.charAt(iidx)
                  if (chBefore !== '\\' && ch === marker) {
                    linkTitle = raw.slice(markerIdx + 1, iidx)
                    linkTitle = restoreBackslashEscapes(linkTitle)
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
                      linkTitle = restoreBackslashEscapes(linkTitle)
                      break
                    }
                  }
                  iidx++
                  chBefore = ch
                }
              }
              
              if (linkTitle !== undefined) {
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
            const delimsBetween = delimStack.detach(leftDim.next, delimStack._tail)
            removeItem(leftDim)

            flushText()
            const inlinesBetween = nodeList.detach(leftDim.item.textNode.next, nodeList._tail)
            removeItem(leftDim.item.textNode)

              
            if (linkLabel !== undefined) {
              nodeList.pushBack({
                type: linkType,
                children: processEmphasis(delimsBetween, inlinesBetween),
                label: linkLabel
              })
            } else {
              // @ts-ignore
              nodeList.pushBack({
                type: linkType,
                dest: linkDest,
                title: linkTitle,
                children: processEmphasis(delimsBetween, inlinesBetween)
              })
            }
            // @ts-ignore
            idx = nextIdx
            textBeginIdx = idx
            normal = false
          }
    
        }
      } else if (ch === '_' || ch === '*') {
        const iidx = skipRepeat(raw, idx)
        const chAfter = raw.charAt(iidx)
        const { canOpen, canClose } = getEmphasisDelimiterEffect(ch, chBefore, chAfter)
        
        if (canOpen || canClose) {
          flushText()
          const delimItem = insertEmphasisDelim(ch, iidx - idx, idx, canOpen, canClose)
          idx = iidx
          textBeginIdx = iidx
        } else {
          idx = iidx
        }
        
        normal = false
      } 
    }



    if (normal && ch === '\n') {
      if (consecutiveSpaceNum >= 2) {
        idx -= consecutiveSpaceNum
        flushText()
        idx += consecutiveSpaceNum

        nodeList.pushBack({
          type: NodeType.HARD_LINE_BREAK
        })
      } else if (chBefore === '\\') {
        flushText()
        nodeList.pushBack({
          type: NodeType.HARD_LINE_BREAK
        })
      } else {
        flushText()
        nodeList.pushBack({
          type: NodeType.SOFT_LINE_BREAK
        })
      }
      idx++
      textBeginIdx = idx
      normal = false
    }

    consecutiveSpaceNum = ch === ' ' ? consecutiveSpaceNum + 1 : 0

    if (normal) idx++
    chBefore = ch
  }

  flushText()
  
  processEmphasis(delimStack, nodeList)

  return nodeList
}

function processEmphasis(delimStack: DoublyLinkedList<Delimiter>, nodeList: DoublyLinkedList<InlineNode>) {
  let closerPtr = delimStack.front()
  const startPos: DoublyLinkedListItem<EmphasisDelim>[] = Array(6).fill(delimStack._head)
  while (true) {
    let closer: DoublyLinkedListItem<EmphasisDelim> | undefined = undefined
    while (closerPtr !== delimStack._tail) {
      if ((closerPtr.item.type === '*' || closerPtr.item.type === '_') && closerPtr.item.canClose) {
        closer = closerPtr as DoublyLinkedListItem<EmphasisDelim>
        break
      }
      closerPtr = closerPtr.next
    }

    if (!closer) {
      // closer not found
      break
    }

    let posMapIdx = closer.item.modLength + (closer.item.type === '*' ? 0 : 3)

    
    while (closer.item.length) {
      let openerPtr = closer.last
      let opener: DoublyLinkedListItem<EmphasisDelim> | undefined = undefined

      while (openerPtr !== delimStack._head && openerPtr !== startPos[posMapIdx]) {
        if (openerPtr.item.type === closer.item.type && (openerPtr.item as EmphasisDelim).canOpen) {
          // rule 9-10
          const matched = !((openerPtr.item.canClose || closer.item.canOpen) && (openerPtr.item.modLength + closer.item.modLength) === 3)
          if (matched) {
            opener = openerPtr as DoublyLinkedListItem<EmphasisDelim>
            break
          }
        }
        openerPtr = openerPtr.last
      }

      if (!opener) break

      // remove any delimiters between
      delimStack.removeItems(opener.next, closer)
      
      while (opener.item.length && closer.item.length) {
        const empDelimLen = (opener.item.length >= 2 && closer.item.length >= 2) ? 2 : 1
        const empType = (empDelimLen === 2) ? NodeType.STRONG_EMPHASIS : NodeType.EMPHASIS
        opener.item.length -= empDelimLen
        closer.item.length -= empDelimLen
        opener.item.textNode.item.raw = opener.item.textNode.item.raw.slice(0, -empDelimLen)
        closer.item.textNode.item.raw = closer.item.textNode.item.raw.slice(empDelimLen)
        const nd: Emphasis | StrongEmphasis = {
          type: empType,
          children: nodeList.detach(opener.item.textNode.next, closer.item.textNode)
        }
        insertAfter(opener.item.textNode as DoublyLinkedListItem<InlineNode>, nd)
      }

      if (opener.item.length === 0) {
        openerPtr = opener.last
        removeItem(opener.item.textNode)
        removeItem(opener)
      }
    }

    if (closer.item.length) {
      // opener not found
      const closer_next = closer.next
      startPos[posMapIdx] = closer.last
      if (!closer.item.canOpen) {
        removeItem(closer)
      }
      closerPtr = closer_next
    } else {
      // closer runs out of its length
      removeItem(closer.item.textNode)
      closerPtr = closerPtr.next
      removeItem(closer)
    }
  }
  return nodeList
}