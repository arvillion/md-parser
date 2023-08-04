
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

export const linkRefRules = {
  // TODO: A link label can have at most 999 characters inside the square brackets.
  label: /\[[\w\W]*?[^ \t\n][\w\W]*?(?<!\\)\]/y,
  dest: (raw: string, idx: number) => {
    const iidx = idx
    let matched = false
    if (raw.charAt(idx) === '<') {
      idx++
      let chBefore = '<'
      while (idx < raw.length) {
        const ch = raw.charAt(idx)
        if (chBefore !== '\\' && ch === '>') {
          matched = true
          idx++
          break
        }
        if ((ch !== '\\' && ch === '<') || ch === '\n') {
          matched = false
          break
        }
        idx++
        chBefore = ch
      }
    } else {
      let chBefore = ''
      const parStack: string[] = []
      while (idx < raw.length) {
        const ch = raw.charAt(idx)
        const chCode = raw.charCodeAt(idx)
        // does not include ASCII control characters or space character
        if (chCode <= 32) {
          matched = true
          break
        }
        if (chBefore !== '\\') {
          if (ch === '(') {
            parStack.push('(')
          } else if (ch === ')') {
            if (!parStack.pop()) {
              matched = false
              break
            }
          }
        }
        idx++
        chBefore = ch
      }
      if (parStack.length) {
        matched = false
      }
    }
    if (!matched) {
      idx = iidx
    }
    return {
      matched,
      idx
    }
  },
  // may not contain a blank line
  // should be satisfied before invoking title
  title: (raw: string, idx: number) => {
    const iidx = idx
    const rule = /(["'])[\w\W]*?(?<!\\)\1/y
    rule.lastIndex = idx
    if (rule.test(raw)) {
      return {
        matched: true,
        idx: rule.lastIndex
      }
    }
    let matched = false
    if (raw.charAt(idx) === '(') {
      idx++
      let chBefore = '('
      while (idx < raw.length) {
        const ch = raw.charAt(idx)
        if (chBefore !== '\\') {
          if (ch === '(') {
            matched = false
            break
          } else if (ch === ')') {
            matched = true
            idx++
            break
          }
        }
        idx++
        chBefore = ch
      }
    }
    if (!matched) {
      idx = iidx
    }
    return {
      matched: false,
      idx: iidx
    }
  }
  
}

export const autoLinkRule = /<(?:([a-zA-Z][a-zA-Z0-9+.-]{1,31}:[^\x00-\x1f\x7f <>]*)|([a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*))>/y

// html comment rule is contained in declaration rule
export const htmlInlineRule = new RegExp(`(?:<!\\[CDATA\\[[\\w\\W]*?\\]\\]>)|(?:<![\\w\\W]*?>)|(?:<\\?[\\w\\W]*?\\?>)|(?:${htmlRules.openTag})|(?:${htmlRules.closingTag})`, 'y')