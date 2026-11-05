// Read text from an uploaded CV: PDF, Word (.docx) or plain text
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import mammoth from 'mammoth/mammoth.browser.js'

GlobalWorkerOptions.workerSrc = workerUrl

export async function readCvFile(file) {
  const name = file.name.toLowerCase()
  let text = ''
  if (name.endsWith('.pdf') || file.type === 'application/pdf') {
    const pdf = await getDocument({ data: await file.arrayBuffer() }).promise
    for (let p = 1; p <= Math.min(pdf.numPages, 8); p++) {
      const content = await (await pdf.getPage(p)).getTextContent()
      let lastY = null
      for (const item of content.items) {
        // a new line starts when the vertical position changes
        if (lastY !== null) text += Math.abs(item.transform[5] - lastY) > 4 ? '\n' : ' '
        text += item.str
        lastY = item.transform[5]
      }
      text += '\n'
    }
  } else if (name.endsWith('.docx')) {
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })
    text = result.value
  } else {
    text = await file.text()
  }
  return text.replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n\n').trim()
}
