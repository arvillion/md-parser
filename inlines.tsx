
import { Node, NodeType, linkTypes } from "./Node"
import { DoublyLinkedList, DoublyLinkedListItem, removeItem } from "./doublyLinkedList"
import { DelimiterStackItem } from "./DelimiterStack"
import { asciiControlPattern, getEmphasisDelimiterEffect, normalizeLinkLabel } from "./utils"
import { AbsChar } from "./common"

const labelMap = new Map<string, string>()

interface SharedState {
    textBuffer: string
    charBefore: AbsChar
    charAfter: AbsChar
    nodeList: DoublyLinkedList<Node>
    delimiterStack: DoublyLinkedList<DelimiterStackItem>
    stackBottom?: DelimiterStackItem
}

interface ParseResult {
    sliceLength: number
    ok: boolean
}

function newState(): SharedState {
    return {
        textBuffer: '',
        charBefore: null,
        charAfter: null,
        nodeList: new DoublyLinkedList<Node>,
        delimiterStack: new DoublyLinkedList<DelimiterStackItem>,
        stackBottom: undefined 
    }
}

function flushTextBuffer(state: SharedState) {
    if (state.textBuffer) {
        state.nodeList.append({
            type: NodeType.TEXT,
            raw: state.textBuffer,
            children: null
        })
        state.textBuffer = ""
    }
}

function pushTextNode(text: string, state: SharedState) {
    const { nodeList } = state
    const node: Node = {
        type: NodeType.TEXT,
        raw: text,
        children: null
    }
    const ptr = nodeList.append(node)
    return ptr
}

function lookForLinkOrImage(state: SharedState): Node {
    const { delimiterStack, nodeList } = state
    let it = delimiterStack.tail()

    while (it && !(it.item.type in ['![', '['])) {
        it = it.last
    }

    if (it && it.item.type in ['![', '[']) {
        if (it.item.isActive) {
            let nodeType: NodeType = NodeType.UNKNOWN
            const ok = nodeType !== NodeType.UNKNOWN


            if (ok) {
                let raw = ""
                let childrenRaw = ""
                let nodeIt: DoublyLinkedListItem<Node> | null = it.item.nodePtr
                raw += nodeIt.item.raw
                
                while (nodeIt) {
                    childrenRaw += nodeIt.item.raw
                    nodeIt = nodeIt.next
                }

                raw += ']'
                
                state.stackBottom = it.item
                const node: Node = {
                    type: nodeType,
                    raw,
                    children: parseInlines(childrenRaw)
                }
                if (nodeType in linkTypes) {
                    // set all [ delimiters before the opening delimiter to inactive
                    let iit = it
                    while (iit) {
                        if (iit.item.type === '[') {
                            iit.item.isActive = false
                        }
                        // @ts-ignore
                        iit = iit.last
                    }
                }
                removeItem(it.item.nodePtr)
                removeItem(it)
                return node
            } else {
                removeItem(it)
                return {
                    type: NodeType.TEXT,
                    raw: ']',
                    children: null
                }
            }
        } else {
            removeItem(it)
            return {
                type: NodeType.TEXT,
                raw: ']',
                children: null
            }
        }
    } else {
        return {
            type: NodeType.TEXT,
            raw: ']',
            children: null
        }
    }
}

interface LinkOrImageParseResult extends ParseResult {
    linkDestRaw?: string
    linkTitleRaw?: string
    nodeType?: NodeType
}

// '![...] or [...]' should have been cut from raw
function parseLinkOrImage(raw: string): LinkOrImageParseResult {
    let isImage = false 
    if (raw.startsWith('!')) {
        raw = raw.slice(1)
        isImage = true
    }

    let nodeType: NodeType = NodeType.UNKNOWN
    let linkDestRaw: string | undefined = undefined // include <>, exclude outermost ()
    let linkTitleRaw: string | undefined = undefined // include outermost quote or ()
    let linkLabelRaw: string | undefined = undefined // exclude outermost brackets

    let idx = 0

    // link destination
    
    if (raw.startsWith('(<')) {
        nodeType = isImage ? NodeType.INLINE_IMAGE : NodeType.INLINE_LINK
        idx = 2

        // skip spaces, tabs, and up to one line ending
        while (idx < raw.length && raw.charAt(idx) in [' ', '\t']) idx++
        if (raw.charAt(idx) === '\n') idx++
        while (idx < raw.length && raw.charAt(idx) in [' ', '\t']) idx++


        let charBefore = raw.charAt(idx - 1)
        let ok = false
        while (idx < raw.length) {
            const currentChar = raw.charAt(idx)
            // contains no line endings or unescaped < or > characters
            if (currentChar === '\n') {
                ok = false
                break
            } else if (charBefore !== '\\') {
                if (currentChar === '<') {
                    ok = false
                    break
                } else if (currentChar === '>') {
                    ok = true
                    break
                }
            }
            idx++
            charBefore = currentChar
        }
        if (ok) {
            linkDestRaw = raw.slice(1, idx + 1)
        }
    } else if (raw.startsWith('(')) {
        nodeType = isImage ? NodeType.INLINE_IMAGE : NodeType.INLINE_LINK
        idx = 1

        // skip spaces, tabs, and up to one line ending
        while (idx < raw.length && raw.charAt(idx) in [' ', '\t']) idx++
        if (raw.charAt(idx) === '\n') idx++
        while (idx < raw.length && raw.charAt(idx) in [' ', '\t']) idx++

        let charBefore = raw.charAt(idx - 1)
        let ok = true
        const parentheseStack: string[] = []

        while (idx < raw.length) {
            const currentChar = raw.charAt(idx)
            if (currentChar in [' ', '\t', '\n']) {
                break
            }
            if (charBefore !== '\\') {
                if (currentChar === ')') {
                    if (!parentheseStack.length) {
                        ok = false
                        break
                    }
                    parentheseStack.pop()
                } else if (currentChar === '(') {
                    parentheseStack.push('(')
                }
            } else if (asciiControlPattern.test(currentChar)) {
                // does not include ASCII control characters or space character
                ok = false
                break
            }
            idx++
            charBefore = currentChar
        }
        ok = ok && parentheseStack.length === 0
        if (ok) {
            linkDestRaw = raw.slice(1, idx)
        }
    } else if (raw.startsWith('[')) {
        idx++
        let charBefore = '['
        let ok = false
        const startIdx = idx
        // skip space, tab, or line ending
        while (idx < raw.length && raw.charAt(idx) in [' ', '\t', '\n']) idx++

        if (idx < raw.length && raw.charAt(idx) !== ']') {
            // A link label can have at most 999 characters inside the square brackets.
            while (idx < raw.length && (idx - startIdx) < 999) {
                const currentChar = raw.charAt(idx)
                if (charBefore !== '\\') {
                    if (currentChar === ']') {
                        ok = true
                        break
                    } else if (currentChar === '[') {
                        ok = false
                        break
                    }
                }
                idx++
                charBefore = currentChar
            }
            if (ok) {
                linkLabelRaw = raw.slice(startIdx, idx)
                const normalizedLabel = normalizeLinkLabel(linkLabelRaw)
                if (!labelMap.has(normalizedLabel)) {
                    return {
                        sliceLength: 0,
                        ok: false
                    }
                }
                nodeType = isImage ? NodeType.FULL_REF_IMAGE : NodeType.FULL_REF_LINK
                
            } else {
                return {
                    sliceLength: 0,
                    ok: false
                }
            }
        } else {

        }
        
    }

    if (linkDestRaw) {
        // link title
        while (idx < raw.length && raw.charAt(idx) in [' ', '\t']) idx++
        if (raw.charAt(idx) === '\n') idx++
        while (idx < raw.length && raw.charAt(idx) in [' ', '\t']) idx++
        
        if (idx + 1 < raw.length) {
            const opener = raw.charAt(idx)
            let ok = false
            if (opener in ['"', "'"]) {
                const startIdx = idx
                idx++
                let currentChar = raw.charAt(idx)
                let charBefore = raw.charAt(idx - 1)
                while (idx < raw.length) {
                    if (charBefore !== '\\' && currentChar === opener) {
                        linkTitleRaw = raw.slice(startIdx, idx + 1)
                        ok = true
                        break
                    }
                    charBefore = currentChar
                    idx++
                }
            } else if (opener === '(') {
                const startIdx = idx
                idx++
                let currentChar = raw.charAt(idx)
                let charBefore = raw.charAt(idx - 1)
                while (idx < raw.length) {
                    if (charBefore !== '\\' && currentChar === ')') {
                        linkTitleRaw = raw.slice(startIdx, idx + 1)
                        ok = true
                        break
                    }
                    charBefore = currentChar
                    idx++
                }
            } else {
                ok = true
            }
            if (!ok) {
                return {
                    sliceLength: 0,
                    ok: false
                }
            }
        }

        if (linkTitleRaw) {
            while (idx < raw.length && raw.charAt(idx) in [' ', '\t']) idx++
            if (raw.charAt(idx) === '\n') idx++
            while (idx < raw.length && raw.charAt(idx) in [' ', '\t']) idx++
        }
    } 

    if (nodeType in [NodeType.INLINE_LINK, NodeType.INLINE_LINK]) {
        if (raw.charAt(idx) === ')') {
            return {
                sliceLength: isImage ? idx + 2 : idx + 1,
                ok: true,
                linkDestRaw,
                linkTitleRaw
            }
        } else {
            return {
                sliceLength: 0,
                ok: false
            }
        }
    }
    
    else {
        // shortcut link or invalid
    }
}

function processEmphasis() {

}

function parseInlines(markdownRaw: string): DoublyLinkedList<Node> {
    const sharedState = newState()
    let rawCopy = markdownRaw
    let charBefore: AbsChar = null
    const { nodeList, delimiterStack } = sharedState

    while (rawCopy.length) {

        const currentChar = rawCopy.charAt(0)
        let sliceLength = 0
    
        if (charBefore !== '\\') {
            if (currentChar === '*' || currentChar === '_') {
                let delimiterRunLength = 1
                while (delimiterRunLength < rawCopy.length && rawCopy.charAt(delimiterRunLength) === currentChar) {
                delimiterRunLength++
                }
                sliceLength = delimiterRunLength
                
                const charAfter = delimiterRunLength < rawCopy.length ? rawCopy.charAt(delimiterRunLength) : null
                const { canOpen, canClose } = getEmphasisDelimiterEffect(currentChar, charBefore, charAfter)
        
                const delimiterRun = currentChar.repeat(delimiterRunLength)
                if (!(canOpen || canClose)) {
                    // treat as normal text
                    sharedState.textBuffer += delimiterRun
                } else {
                    flushTextBuffer(sharedState)
                    const nodePtr = pushTextNode(delimiterRun, sharedState)
                    delimiterStack.append({
                        type: currentChar,
                        nodePtr,
                        isActive: true,
                        canOpen,
                        canClose,
                    })
                }
            } else if (rawCopy.startsWith("![")) {
                flushTextBuffer(sharedState)
                const nodePtr = pushTextNode("![", sharedState)
                delimiterStack.append({
                    type: "![",
                    nodePtr,
                    isActive: true,
                })
                sliceLength = 2
            } else if (currentChar === '[' ) {
                flushTextBuffer(sharedState)
                const nodePtr = pushTextNode(currentChar, sharedState)
                delimiterStack.append({
                    type: "![",
                    nodePtr,
                    isActive: true,
                })
                sliceLength = 1
            } else if (currentChar === ']') {

            } else {
                sharedState.textBuffer += currentChar
                sliceLength = 1 
            }
        } else {
            // TODO: handle 转义
        }

        charBefore = rawCopy.charAt(sliceLength - 1)  
        rawCopy = rawCopy.slice(sliceLength)
    }
    flushTextBuffer(sharedState)

}

const result = parseInlines("*(**foo**)*")
console.log(result)

