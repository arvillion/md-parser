// const markdownRaw = "*(**foo**)*"

// const nodeList = []

// let rawCopy = markdownRaw

// let textBuffer = ""

// const T_TEXT_NODE = "T_TEXT_NODE"
// const lastCharIsBackslash = false
// const lastCharIsExclamation = false
// const sliceLength = 0

// const flushTextBuffer = () => {
//   if (text) {
//     nodeList.push({
//       type: T_TEXT_NODE,
//       text: textBuffer
//     })
//     textBuffer = ""
//   }
// }

// class DoublyLinkedListItem {
//   constructor ({ node, info = {}, next, last } = {}) {
//     this.node = node
//     this.info = { ...info }
//     this.next = next
//     this.last = last
//   }
// }

// const linkedListHead = new DoublyLinkedListItem() // dummy head
// let linkedListTail = linkedListHead

// function appendToLinkedList()



// while (rawCopy.length) {
//   let delimiterRunLength = 0

//   const char = rawCopy.charAt(0)
//   const shouldCheckDelimiterRun = false
//   if (char in ['*', '_'] && lastCharIsBackslash === false) {
//     shouldCheckDelimiterRun = true
//   }

//   if (shouldCheckDelimiterRun) {
//     while (delimiterRunLength < rawCopy.length) {
//       const currentChar = rawCopy.charAt(delimiterRunLength)
//       if (currentChar in ['*', '_'] && (delimiterRunLength || currentChar === char)) {
//         delimiterRunLength++
//       } else {
//         break
//       }
//     }
//   }

//   if (delimiterRunLength) {
//     // process sequence of * and _
//     flushTextBuffer()
//     nodeList.push({
//       type: T_TEXT_NODE,
//       text: char.repeat(delimiterRunLength)
//     })
//     sliceLength = delimiterRunLength
//   } else if (char === '[') {
//     if (lastCharIsExclamation) {
//       // process ![
//       textBuffer = textBuffer.slice(0, -1)
//       flushTextBuffer()
//       nodeList.push({
//         type: T_TEXT_NODE,
//         text: '!['
//       })
//     } else {
//       // process [
//       flushTextBuffer()
//       nodeList.push({
//         type: T_TEXT_NODE,
//         text: char
//       })
//     }
//     sliceLength = 1
//   } else if () {

//   } else {
//     sliceLength = 1
//     textBuffer += char
//   }
  
//   const lastChar = rawCopy.charAt(sliceLength - 1)
//   rawCopy = rawCopy.slice(sliceLength)
//   lastCharIsBackslash = lastChar === '\\' ? true : false;
//   lastCharIsExclamation = lastChar === '!' ? true : false;
// }
