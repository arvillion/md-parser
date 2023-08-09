// A Unicode whitespace character is any code point in the Unicode Zs general category, or a tab (U+0009), line feed (U+000A), form feed (U+000C), or carriage return (U+000D).
const unicodeWhitespaceRegex = /^[\t\f\r\n\p{Zs}]/

// An ASCII punctuation character is !, ", #, $, %, &, ', (, ), *, +, ,, -, ., / (U+0021–2F), :, ;, <, =, >, ?, @ (U+003A–0040), [, \, ], ^, _, ` (U+005B–0060), {, |, }, or ~ (U+007B–007E).
const ASCIIpunctuations = ['!', '"', '#', '$', '%', '&', "'", '(', ')', '*', '+', ',', '-', '.', '/', ':', ';', '<', '=', '>', '?', '@', '[', '\\', ']', '^', '_', '`', '{', '|', '}', '~']

// A Unicode punctuation character is an ASCII punctuation character or anything in the general Unicode categories Pc, Pd, Pe, Pf, Pi, Po, or Ps.
const extraPunctuationRegex = /^[\p{Pc}\p{Pd}\p{Pe}\p{Pf}\p{Pi}\p{Po}\p{Ps}]/
const testUnicodePunctuation = (ch: string) => ch !== null && (ch in ASCIIpunctuations || extraPunctuationRegex.test(ch))

export const asciiControlRegex = /^[\x00-\x1F\x7F]/;

// A left-flanking delimiter run is a delimiter run that is 
// (1) not followed by Unicode whitespace, 
// and either (2a) not followed by a Unicode punctuation character, or
//            (2b) followed by a Unicode punctuation character and preceded by Unicode whitespace or a Unicode punctuation character. 
// For purposes of this definition, the beginning and the end of the line count as Unicode whitespace.

function isLeftFlankingDelimiter(chBefore: string, chAfter: string) {
  if (chBefore === null) chBefore = ' '
  if (chAfter === null) chAfter = ''
  return !unicodeWhitespaceRegex.test(chAfter) && (!testUnicodePunctuation(chAfter) || unicodeWhitespaceRegex.test(chBefore) || testUnicodePunctuation(chBefore))
}

// A right-flanking delimiter run is a delimiter run that is 
// (1) not preceded by Unicode whitespace, 
// and either (2a) not preceded by a Unicode punctuation character, or 
//            (2b) preceded by a Unicode punctuation character and followed by Unicode whitespace or a Unicode punctuation character. 
// For purposes of this definition, the beginning and the end of the line count as Unicode whitespace.

function isRightFlankingDelimiter(chBefore: string, chAfter: string) {
  if (chBefore === null) chBefore = ' '
  if (chAfter === null) chAfter = ''
  return !unicodeWhitespaceRegex.test(chBefore) && (!testUnicodePunctuation(chBefore) || unicodeWhitespaceRegex.test(chAfter) || testUnicodePunctuation(chAfter))
}

export function getEmphasisDelimiterEffect(type: '*' | '_', chBefore: string, chAfter: string) {
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

/**
 * Remove initial and final spaces or tabs.
 */
export function trimParagraph(raw: string) {
  return raw.replace(/^[\t ]|[\t ]$/g, '')
}

/**
 * Remove final line break
 */
export function removeFinalLineBreak(raw: string) {
  return raw.endsWith('\n') ? raw.slice(0, -1) : raw
}

