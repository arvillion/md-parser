import { AbsChar } from "./common"

// A Unicode whitespace character is any code point in the Unicode Zs general category, or a tab (U+0009), line feed (U+000A), form feed (U+000C), or carriage return (U+000D).
const unicodeWhitespaceRegex = /^[\t\f\r\n\p{Zs}]/u

// An ASCII punctuation character is !, ", #, $, %, &, ', (, ), *, +, ,, -, ., / (U+0021–2F), :, ;, <, =, >, ?, @ (U+003A–0040), [, \, ], ^, _, ` (U+005B–0060), {, |, }, or ~ (U+007B–007E).
const ASCIIpunctuations = ['!', '"', '#', '$', '%', '&', "'", '(', ')', '*', '+', ',', '-', '.', '/', ':', ';', '<', '=', '>', '?', '@', '[', '\\', ']', '^', '_', '`', '{', '|', '}', '~']

// A Unicode punctuation character is an ASCII punctuation character or anything in the general Unicode categories Pc, Pd, Pe, Pf, Pi, Po, or Ps.
const extraPunctuationRegex = /^[\p{Pc}\p{Pd}\p{Pe}\p{Pf}\p{Pi}\p{Po}\p{Ps}]/u
const testUnicodePunctuation = (ch: AbsChar) => ch !== null && (ch in ASCIIpunctuations || extraPunctuationRegex.test(ch))

// A left-flanking delimiter run is a delimiter run that is 
// (1) not followed by Unicode whitespace, 
// and either (2a) not followed by a Unicode punctuation character, or
//            (2b) followed by a Unicode punctuation character and preceded by Unicode whitespace or a Unicode punctuation character. 
// For purposes of this definition, the beginning and the end of the line count as Unicode whitespace.

function isLeftFlankingDelimiter(chBefore: AbsChar, chAfter: AbsChar) {
  if (chBefore === null) chBefore = ' '
  if (chAfter === null) chAfter = ''
  return !unicodeWhitespaceRegex.test(chAfter) && (!testUnicodePunctuation(chAfter) || unicodeWhitespaceRegex.test(chBefore) || testUnicodePunctuation(chBefore))
}

// A right-flanking delimiter run is a delimiter run that is 
// (1) not preceded by Unicode whitespace, 
// and either (2a) not preceded by a Unicode punctuation character, or 
//            (2b) preceded by a Unicode punctuation character and followed by Unicode whitespace or a Unicode punctuation character. 
// For purposes of this definition, the beginning and the end of the line count as Unicode whitespace.

function isRightFlankingDelimiter(chBefore: AbsChar, chAfter: AbsChar) {
  if (chBefore === null) chBefore = ' '
  if (chAfter === null) chAfter = ''
  return !unicodeWhitespaceRegex.test(chBefore) && (!testUnicodePunctuation(chBefore) || unicodeWhitespaceRegex.test(chAfter) || testUnicodePunctuation(chAfter))
}

interface DelimiterEffect {
  canOpen: boolean
  canClose: boolean
}

export function getEmphasisDelimiterEffect(type: '*' | '_', chBefore: AbsChar, chAfter: AbsChar): DelimiterEffect {
  const isLeftFD = isLeftFlankingDelimiter(chBefore, chAfter)
  const isRightFD = isRightFlankingDelimiter(chBefore, chAfter)

  let canOpen = false
  let canClose = false

  if (type === '*') {
    canOpen = isLeftFD
    canClose = isRightFD
  } else {
    // _ character can open emphasis iff it is part of a left-flanking delimiter run and either 
    // (a) not part of a right-flanking delimiter run or 
    // (b) part of a right-flanking delimiter run preceded by a Unicode punctuation character.
    canOpen = !isRightFD || testUnicodePunctuation(chBefore)
    // _ character can close emphasis iff it is part of a right-flanking delimiter run and either 
    // (a) not part of a left-flanking delimiter run or 
    // (b) part of a left-flanking delimiter run followed by a Unicode punctuation character.
    canClose = !isLeftFD || testUnicodePunctuation(chAfter)
  }
  return {
    canOpen, canClose
  }
}

export function checkLastChar(char: string | null) {

  const ret = {
    
  }
  // single character
  let lastCharIsBackslash: boolean = false
  let lastCharIsExclamation: boolean = false
  let lastCharIsLineBeginning: boolean = true // set this to true at the right begining of each line iteration

  // category
  let lastCharIsUnicodeWhitespace: boolean = false
  let lastCharIsUnicodePunctuation: boolean = false

  if (char === null) lastCharIsLineBeginning = true
  else if (char === '\\') lastCharIsBackslash = true
  else if (char === '!') lastCharIsExclamation = true
  
  lastCharIsUnicodePunctuation = testUnicodePunctuation(char)
}