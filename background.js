/**
 * Injects the content script and the Jquery library into each active tab
 * @param tabId - the id of the seleted tab
 * @returns {Promise<void>}
 */
async function injectScript (tabId) {
  await chrome.scripting.executeScript({
    target: { tabId: tabId }, files: ['lib/jquery-3.6.0.js', 'js/script.js'],
  })
}

/**
 * Handles incoming messages from the content script
 * @param port - the port on which the messages were sent
 */
function handleMessages (port) {
  switch (port.name) {
    case 'extractKeywords':
      port.onMessage.addListener(async (message) => {
        const relevantKeywords = await extractKeywords(port, message.data.title)
        port.postMessage(relevantKeywords)
      })
      break
    case 'fetchNews':
      port.onMessage.addListener(async (message) => {
        const articleData = await fetchNews(port, message.data.keywords)
        port.postMessage(articleData)
      })
      break
  }
}

/**
 * Extracts keywords from the given string using the MonkeyLearn KeywordExtractor
 * @param port
 * @param title - the given string
 * @returns {Promise<*[]>}
 */
async function extractKeywords (port, title) {
  const URL = 'https://api.monkeylearn.com/v3/extractors/ex_YCya9nrn/extract/'
  const body = { data: [title] }
  return fetch(URL, {
      method: 'POST',
      headers: {
        'Authorization': 'Token ' + AUTH_TOKEN',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
    }
  ).then((response) => response.json())
    .then(json => {
        let relevantKeywords = []
        const extractions = json[0]['extractions']
        extractions.forEach((extraction) => {
            let relevance = extraction['relevance']
            if (relevance >= 0.6) {
              relevantKeywords.push({ keyword: extraction['parsed_value'], relevance: extraction['relevance'] })
            }
          }
        )
        return relevantKeywords
      }
    )
}

/**
 * Loads a regular news article (limitation discussed in the paper) from the NewsAPI
 * @param port
 * @param keywords - the extracted keywords used for search
 * @returns {Promise<{publishedAt: *, author: *, description: *, source: *, title: *, url: *, storyMatch: string}>}
 */
async function fetchNews (port, keywords) {
  let queryKeywords = []
  keywords.forEach(keyword => {
    queryKeywords.push(keyword['keyword'])
  })
  const URL = 'https://newsapi.org/v2/everything?sortBy=relevancy&q=' + queryKeywords.join('+')
  return fetch(URL, {
      headers: {
        'Authorization': AUTH_TOKEN,
      },
    }
  ).then((response) => response.json())
    .then(json => {
      const matchedArticle = json['articles'][0]
      const storyMatch = generateStoryMatch(keywords, matchedArticle)
      return ({
        title: matchedArticle.title,
        author: matchedArticle.author,
        url: matchedArticle.url,
        storyMatch: storyMatch,
        description: matchedArticle.description,
        source: matchedArticle.source.name,
        publishedAt: matchedArticle.publishedAt
      })
    })
}

/**
 * Generates a story match based on: (logic explained in the paper)
 * @param keywords - the keywords extracted
 * @param matchedArticle - the matched news article
 * @returns {string}
 */
function generateStoryMatch (keywords, matchedArticle) {
  const title = matchedArticle.title
  const description = matchedArticle.description
  let fallbackRelevance = 0
  let storyMatch = 0
  keywords.forEach(keyword => {
    const value = keyword['keyword']
    const re = new RegExp(`\\b${value}\\b`, 'gi')
    const titleCount = (title.match(re) || []).length
    const descriptionCount = (description.match(re) || []).length
    const totalCount = titleCount + descriptionCount
    const weightedCount = totalCount * keyword['relevance']
    fallbackRelevance += keyword['relevance']
    storyMatch += weightedCount
  })
  const finalStoryMatch = storyMatch === 0 ? (fallbackRelevance / keywords.length) : (storyMatch / keywords.length)
  if (finalStoryMatch <= 0.5) {
    return 'low'
  } else if (finalStoryMatch <= 0.7) {
    return 'medium'
  } else {
    return 'high'
  }
}

// listen to messages from the contentScript
chrome.runtime.onConnect.addListener(handleMessages)
// load articles when page is loaded
chrome.webNavigation.onDOMContentLoaded.addListener(async (details) => {
  if (details.frameId === 0) {
    await injectScript(details.tabId)
  }
})
