export const htmlRules: Record<string, RegExp> = {
  tagName: /[a-zA-Z][a-zA-Z0-9-]*/,
  attrName: /[a-zA-Z_:][a-zA-Z0-9_.:-]*/,
  attrValue: /(['"])[\w\W]*?\1|[^ \t\n=<>`'"]+/,
}

htmlRules.attrValueSpec = new RegExp(`[ \\t]*\\n?=[ \\t]*\\n?${htmlRules.attrValue.source}`)
// TODO: spaces, tabs, and up to one line ending?
htmlRules.attr = new RegExp(`(?:[ \\t]+|\\n)${htmlRules.attrName.source}(?:${htmlRules.attrValueSpec.source})?`)

htmlRules.openTag = new RegExp(`<${htmlRules.tagName}(?:${htmlRules.attr})*[ \\t]*\\n?/?>`)
htmlRules.closingTag = new RegExp(`</${htmlRules.tagName}[ \\t]*\\n?>`)

const htmlBlockRule6Tags = ['address', 'article', 'aside', 'base', 'basefont', 'blockquote', 'body', 'caption', 'center', 'col', 'colgroup', 'dd', 'details', 'dialog', 'dir', 'div', 'dl', 'dt', 'fieldset', 'figcaption', 'figure', 'footer', 'form', 'frame', 'frameset', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'head', 'header', 'hr', 'html', 'iframe', 'legend', 'li', 'link', 'main', 'menu', 'menuitem', 'nav', 'noframes', 'ol', 'optgroup', 'option', 'p', 'param', 'section', 'source', 'summary', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'title', 'tr', 'track', 'ul']

export const htmlBlockRules = [
  {
    start: /<(?:pre|script|style|textarea)[ \t>\n]/iy,
    end: /.*?<\/(?:pre|script|style|textarea)>.*(?:\n|$)/iy,
  },
  {
    start: /<!--/y,
    end: /.*?-->.*(?:\n|$)/y
  },
  {
    start: /<\?/y,
    end: /.*?\?>.*(?:\n|$)/y
  },
  {
    start: /<![a-zA-Z]/y,
    end: /.*?>.*(?:\n|$)/y,
  },
  {
    start: /<!\[CDATA\[/y,
    end: /.*?\]\]>.*(?:\n|$)/y
  },
  {
    start: new RegExp(`</?(?:${htmlBlockRule6Tags.join('|')})(?: |\\t|\\n|/?>)`, 'iy')
  },
  {
    start: new RegExp(`(?:${htmlRules.openTag.source}|${htmlRules.closingTag.source})[ \t]*(?:\n|$)`, 'y')
  }
]