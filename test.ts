import { NodeType, Node } from "./types";
import * as fs from 'node:fs';
import { parse, printAST } from "./dev-utils"
import { BlockParser } from "./BlockParser";
// import fetch from "node-fetch"

const testDownloadUrl = 'https://spec.commonmark.org/0.30/spec.json'
const filePath = 'spec.json'

let tc: any = null
const caseNo = [481]
// const caseNo = 192 // TODO
let raw = ''
// let raw = `- sasa


// - sasasa`

main()

function runTestCase(caseNo: number) {
  if (!Array.isArray(tc)) {
    throw new Error('test data does not exists')
  }
  const tcc = tc[caseNo - 1]
  if (!tcc) {
    throw new Error(`test case #${caseNo} does not exist`)
  }
  const raw = tcc.markdown
  console.log(`====== Test case #${caseNo} ======`)
  console.log(`raw: ${JSON.stringify(raw)}`)
  console.log(`html: ${JSON.stringify(tcc.html)}`)

  const bp = new BlockParser(raw)
  const blocks = parse(bp)
  printAST(blocks)

}

function runManualTest(raw: string) {
  console.log(`raw: ${JSON.stringify(raw)}`)

  const bp = new BlockParser(raw)
  const blocks = parse(bp)
  printAST(blocks)
}

async function main() {
  
  if (!fs.existsSync(filePath)) {
    console.log("Downloading test cases from " + testDownloadUrl)
    tc = await fetch(testDownloadUrl).then((res: { json: () => any; }) => res.json())
    console.log("Downloaded")
    fs.writeFileSync(filePath, JSON.stringify(tc), {
      flag: 'w',
      encoding: 'utf-8'
    })
  } else {
    const content = fs.readFileSync(filePath, {
      encoding: 'utf-8'
    })
    tc = JSON.parse(content)
  }

  try {
    console.log(NodeType)
    if (raw) {
      runManualTest(raw)
    } else {
      if (Array.isArray(caseNo)) {
        caseNo.forEach(no => {
          runTestCase(no)
          console.log()
        })
      } else {
        runTestCase(caseNo)
      }
    }
  } catch (e) {
    console.error(e)
  }
}




