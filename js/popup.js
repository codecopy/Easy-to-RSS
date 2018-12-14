function getRootURL(){
    return new Promise((resolve, reject) => {
        chrome.storage.local.get({"serveraddress": 'https://rsshub.app'}, function(rst) {
            root = rst["serveraddress"];
            if(root === '') root = 'https://rsshub.app';
            else if(root.indexOf("http") === -1) root = 'http://' + root;
            resolve(root);
        });
    })
}

/**
 * @author idealclover
 * @param {string} url the url needs to be compared
 * @param {function} callback giveback the rss list found in RSSHub
 */
function searchRSSHub(root, url, feeds) {
    return new Promise((resolve,reject) => {
        // For every domain in the data json, extract compare url and output.
        // The data json is in data.js and format is like the following.
        for (var key in data) {
            //extract root url
            var regex = new RegExp(key + '(\\S*)');
            var path = url.match(regex);
            if (path === null) {
                continue;
            }
            path = path[1];

            var results = [];
            var router = {};
            // For every pattern in the domain, compare it with the given url.
            for (var j = 0; j < data[key].length; j++) {
                // Because for muti url, router-recognizer only return 1 best, the RouteRecognizer should be init in every loop.
                router = new RouteRecognizer();
                // The handler contains the rest information for the rest process.
                router.add([{path: data[key][j]["src"], handler: [data[key][j]["dst"], data[key][j]["name"]]}]);
                var result = router.recognize(path);
                if (result) {
                    results.push(result[0]);
                }
                router = {};
            }

            //for every result, format it into a list
            for (var i = 0; i < results.length; i++) {
                var rst = results[i].handler[0];
                var title = results[i].handler[1];
                for (var param in results[i].params) {
                    // link every param in the pattern with the result
                    rst = rst.replace(':' + param, results[i].params[param]);
                    if (title) {
                        // if title has some params, link them
                        title = title.replace(':' + param, results[i].params[param]);
                    }
                }
                var feed_url = (root + rst);
                var feed = {
                    type: '',
                    url: feed_url,
                    title: 'RSSHub: ' + (title || feed_url)
                };
                feeds.push(feed);
            }
        }
        resolve(feeds);
    });
}

/**
 * @author idealclover
 * @param {string} url the url needs to be compared
 * @param {function} callback giveback the rss list found in Original Website
 */
function searchOriginRSS(root, url, feeds) {
    return new Promise((resolve,reject) => {
        var x = new XMLHttpRequest();
        x.open('GET', url);
        x.responseType = '';
        x.onload = function () {

            var types = [
                'application/rss+xml',
                'application/atom+xml',
                'application/rdf+xml',
                'application/rss',
                'application/atom',
                'application/rdf',
                'text/rss+xml',
                'text/atom+xml',
                'text/rdf+xml',
                'text/rss',
                'text/atom',
                'text/rdf'
            ];

            var parser = new DOMParser();
            var htmlDoc = parser.parseFromString(x.responseText, "text/html");
            var links = htmlDoc.querySelectorAll("link[type]");

            for (var i = 0; i < links.length; i++) {
                if (links[i].hasAttribute('type') && types.indexOf(links[i].getAttribute('type')) !== -1) {
                    var feed_url = links[i].getAttribute('href');

                    // If feed's url starts with "//"
                    if (feed_url.indexOf("//") === 0)
                        feed_url = "http:" + feed_url;
                    // If feed's url starts with "/"
                    else if (feed_url.startsWith('/'))
                        feed_url = url.split('/')[0] + '//' + url.split('/')[2] + feed_url;
                    // If feed's url starts with http or https
                    else if (/^(http|https):\/\//i.test(feed_url))
                        feed_url = feed_url;
                    else
                        feed_url = url + "/" + feed_url.replace(/^\//g, '');

                    var feed = {
                        type: links[i].getAttribute('type'),
                        url: feed_url,
                        title: 'Origin: ' + (links[i].getAttribute('title') || feed_url)
                    };

                    feeds.push(feed);
                }
            }
            resolve(feeds);
        };

        x.onerror = function () {
            return [];
        };

        x.send();
    });
}

/**
* Prints message in #feeds
* @author idealclover
* @param {string} msg messages should render to div
 */
function render(msg) {
    document.getElementById('feeds').innerHTML = msg;
}

/**
 * add feeds to html
 * @author idealclover
 */
function addFeeds(feeds) {
    html = ''
    for (var i = 0; i < feeds.length; i++) {
        html += '<li><a href="' + feeds[i].url + '" title="' + feeds[i].type + '" target="_blank">' + feeds[i].title + '</a></li>';
    }
    if (html === '') {
        render("No feeds found");
    } else {
        render('<ul id="feeds">' + html + '</ul>');
    }
}

window.onload = function(){
    var list = document.getElementById("feeds");
    list.addEventListener("click",function(event){
        if(event.target.nodeName !== "A"){
            return;
        }
        const input = document.createElement('input');
        document.body.appendChild(input);
        input.setAttribute('value', event.target.href);
        input.select();
        document.execCommand("copy");
        document.body.removeChild(input);
        alert("Copied to clipboard.");
    });
}

document.addEventListener('DOMContentLoaded', function () {
    chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {
        var url = tabs[0].url;
        getRootURL().then((root) => {
            let p = Promise.all([searchRSSHub(root, url, []), searchOriginRSS(root, url, [])]);
            p.then((feeds) => {
                addFeeds(feeds[0].concat(feeds[1]));
            });
        });
    });
});
