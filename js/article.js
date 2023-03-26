const url = $(location).attr('href')
const id = url.split('?')[1].split('=')[1]

/**
 * Receives the messages from the content script and fills in the relevant values accordingly
 * @param request - the content of the message
 */
function handleMessages (request) {
  switch (request.query) {
    case 'updateContents':
      if (request.data.id === id) {
        const articleData = request.data.articleData
        const title = $('.title')
        title.html(articleData.title)
        title.attr('href', articleData.url)
        title.attr('target', '_blank')
        $('.author').html(articleData.author)
        const storyMatch = articleData.storyMatch
        const storyMatchSelector = $('.story-match')
        storyMatchSelector.html(storyMatch)
        switch (storyMatch) {
          case 'low':
            storyMatchSelector.css('color', 'orange')
            break
          case 'medium':
            storyMatchSelector.css('color', 'blue')
            break
          case 'high':
            storyMatchSelector.css('color', 'green')
            break
        }
        $('.description').html(articleData.description)
        $('.source').html(articleData.source)
        const date = new Date(articleData.publishedAt.substring(0, articleData.publishedAt.indexOf('T')))
        const day = date.getDay().toString()
        const month = date.getMonth().toString()
        const year = date.getFullYear().toString()
        $('.date').html(day + '.' + month + '.' + year)
        break
      }
  }
}

/**
 * Provides the functionality for clicking the expand button
 */
function handleButton () {
  $('.description-container').toggleClass('hidden')
  $('.meta-container').toggleClass('hidden')
  $('.wrapper').toggleClass('small')
  const image = $('.button-image')
  if (image.hasClass('expand')) {
    image.attr('src', '../assets/closeButton.png')
    image.addClass('close')
    image.removeClass('expand')
  } else {
    image.attr('src', '../assets/expandButton.png')
    image.removeClass('close')
    image.addClass('expand')
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementsByClassName('button-container')[0].addEventListener('click', handleButton)
})

chrome.runtime.onMessage.addListener(handleMessages)