// pdfjs-dist (used by DocumentAnnotatorModal/DocumentSignatureModal to open
// uploaded PDFs) calls Promise.withResolvers() unconditionally as of v6.
// Native support: Chrome 119+, Firefox 121+, Safari 17.4+ (all released
// 2023-2024). Government workstations often lag behind current browser
// releases, so without this polyfill an older browser gets a hard crash
// the instant a Secretariat officer tries to open a document to annotate
// or sign it, rather than a graceful error.
if (typeof Promise.withResolvers !== 'function') {
  Promise.withResolvers = function withResolvers() {
    let resolve, reject
    const promise = new Promise((res, rej) => {
      resolve = res
      reject = rej
    })
    return { promise, resolve, reject }
  }
}
