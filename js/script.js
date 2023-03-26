/**
 * Injects iFrames if the URL of the loaded site matches the feeds defined in the topics constant
 */
if (checkURLMatch($(location).attr('href'))) {
  // noinspection JSIgnoredPromiseFromCall
  injectComponents(true, isTestMode())
}

/**
 * Checks if the site is loaded for the first time since the DOM tree changes on subsequent loads
 * @type {MutationObserver}
 */
let URLObserver = new MutationObserver(async () => {
  let currentURL = $(location).attr('href')
  if (checkURLMatch(currentURL)) {
    injectComponents(false, isTestMode())
  }
})
URLObserver.observe(document.querySelector('title'), { subtree: true, characterData: true, childList: true })

/**
 * Defines on which news feeds to inject SJ-articles
 * @param URL the URL of the loaded site
 * @returns {boolean}
 */
function checkURLMatch (URL) {
  const topics = ['CAAqIggKIhxDQkFTRHdvSkwyMHZNRGxqTjNjd0VnSmxiaWdBUAE', 'CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx1YlY4U0FtVnVHZ0pWVXlnQVAB']
  return new RegExp(topics.join('|')).test(URL)
}

/**
 * Checks if a web archive link is loaded which enables the user test mode with static SJ-content
 * @returns {*}
 */
function isTestMode () {
  return $(location).attr('href').includes('web.archive.org')
}

/**
 * Injects SJ-articles as iFrames
 * @param initialLoad
 * @param isTestMode
 */
function injectComponents (initialLoad, isTestMode) {
  $('.iframe-container').remove()

  // create iFrame
  const iFrameComponent = '<iframe ' +
    'src=\'about:blank\' ' +
    'class=\'iframe-container\' ' +
    'style=\'border: 0; overflow: hidden; min-height: 200px; margin-bottom: 32px;\'>' +
    '<p>Your browser does not support iFrames.</p>' +
    '</iframe>'

  // Find articles as parent elements
  let parentElement

  // needed since page structure changes after first load
  if (initialLoad) {
    parentElement = $('body > c-wiz')
  } else {
    parentElement = $('body > c-wiz:last-child')
  }

  let siblingElements = parentElement.find('main').eq(1).children('div').eq(0).children('div')

  // Append new component to parent elements
  siblingElements.each(async (index, element) => {
    if (index === 0 || (isTestMode && index < 10)) {
      const sibling = $(element)
      const siblingWidth = sibling.width()
      sibling.after(iFrameComponent)
      const iFrame = sibling.next('.iframe-container')
      iFrame.width(siblingWidth)

      const id = 'id' + (new Date()).getTime() + index
      iFrame[0].src = `chrome-extension://${chrome.runtime.id}/html/articleSmall.html?id=${id}`

      if (isTestMode) {
        const file = await fetch(chrome.runtime.getURL('assets/articles.json'))
        const articles = await file.json()
        const articleData = articles[index]
        injectContent(articleData, id)
      } else {
        const keywords = await extractKeywords(sibling)
        const articleData = await fetchNews(keywords)
        injectContent(articleData, id)
      }
    }
  })
}

/**
 * Sends message to the background script and waits for the result of the keyword extraction
 * @param element - the element including the title of the original article
 * @returns {Promise<unknown>}
 */
async function extractKeywords (element) {
  return new Promise((resolve) => {
    const title = element.find('article').eq(0).children('h3').children('a').html()
    const port = chrome.runtime.connect({ name: 'extractKeywords' })
    port.postMessage({
      data: {
        title: title
      }
    })
    port.onMessage.addListener((keywords) => {
      resolve(keywords)
    })
  })
}

/**
 * Sends message to the background script and waits for the result of the fetched news article
 * @param keywords - the extracted keywords of the title of the original article
 * @returns {Promise<unknown>}
 */
async function fetchNews (keywords) {
  return new Promise((resolve) => {
    const port = chrome.runtime.connect({ name: 'fetchNews' })
    port.postMessage({
      data: {
        keywords: keywords
      }
    })
    port.onMessage.addListener((articleData) => {
      resolve(articleData)
    })
  })
}

/**
 * Sends a message to all iFrames to load the SJ-article data into the HTML
 * @param articleData - the gathered article data
 * @param id - the id of the iframe to load the data
 * @returns {Promise<any>}
 */
function injectContent (articleData, id) {
  return chrome.runtime.sendMessage({
    query: 'updateContents',
    data: {
      articleData: articleData,
      id: id
    }
  })
}