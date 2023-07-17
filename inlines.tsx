
import { Node, NodeType, linkTypes } from "./Node"
import { DoublyLinkedList, removeItem } from "./doublyLinkedList"
import { DelimiterStackItem } from "./DelimiterStack"
import { getEmphasisDelimiterEffect } from "./utils"
import { AbsChar } from "./common"


interface SharedState {
    textBuffer: string
    charBefore: AbsChar
    charAfter: AbsChar
    nodeList: Node[]
    delimiterStack: DoublyLinkedList<DelimiterStackItem>
    stackBottom?: DelimiterStackItem
}

function newState(): SharedState {
    return {
        textBuffer: '',
        charBefore: null,
        charAfter: null,
        nodeList: [],
        delimiterStack: new DoublyLinkedList<DelimiterStackItem>,
        stackBottom: undefined 
    }
}

function flushTextBuffer(state: SharedState) {
    if (state.textBuffer) {
        state.nodeList.push({
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
    nodeList.push(node)
    return node
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
            let childrenRaw = ""
            if (ok) {
                let raw = ""
                const textNode = it.item.node
                // TODO: optimization: find textNodeIdx without `indexOf` O(n)->O(1)
                const textNodeIdx = nodeList.indexOf(textNode)
                for (let i = textNodeIdx; i < nodeList.length; i++) {
                    raw += nodeList[i].raw
                }
                for (let i = textNodeIdx + 1; i < nodeList.length - 1; i++) {
                    childrenRaw += nodeList[i].raw
                }
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
                // TODO: should delete textNode?
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

function processEmphasis() {

}

function parseInlines(markdownRaw: string): Node[] {
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
                    const node = pushTextNode(delimiterRun, sharedState)
                    delimiterStack.append({
                        type: currentChar,
                        node,
                        isActive: true,
                        canOpen,
                        canClose,
                    })
                }
            } else if (rawCopy.startsWith("![")) {
                flushTextBuffer(sharedState)
                const node = pushTextNode("![", sharedState)
                delimiterStack.append({
                    type: "![",
                    node,
                    isActive: true,
                })
                sliceLength = 2
            } else if (currentChar === '[' ) {
                flushTextBuffer(sharedState)
                const node = pushTextNode(currentChar, sharedState)
                delimiterStack.append({
                    type: "![",
                    node,
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

