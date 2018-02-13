const fs = require('graceful-fs');

const glob = require('glob');
const promisify = require('util.promisify');

const File = require('./value-objects/file');
const UrlsByFile = require('./value-objects/urls-by-file');
const DeadLinksByFile = require('./value-objects/dead-links-by-file');

const findInternalUrls = require('./find-internal-urls');
const urlToFilename = require('./url-to-filename');

const globAsync = promisify(glob);
const readFileAsync = promisify(fs.readFile);
const statAsync = promisify(fs.stat);

module.exports = ({rootFolder, servicePrefixes}) => globAsync(`${rootFolder}/+(${servicePrefixes.join('|')})/**/*.html`)
.then(filenames => Promise.all(
  filenames.map(
    filename => readFileAsync(filename).then(
      fileContent => new File(filename, fileContent.toString())
    )
  )
))
.then(files => files.map(
  file => {
    const urls = findInternalUrls({text: file.fileContent, servicePrefixes});
    return new UrlsByFile(file.filename, urls);
  }
))
.then(urlsByFiles => Promise.all(
  urlsByFiles.map(
    urlsByFile => {
      let deadLinks = [];
      return Promise.all(
        urlsByFile.urls.map(
          url => statAsync(`${rootFolder}/${urlToFilename(url)}`).catch(() => deadLinks.push(url))
        )
      )
      .then(() => new DeadLinksByFile(urlsByFile.filename, deadLinks));
    }
  )
))
.then(deadLinksByFiles => deadLinksByFiles.filter(deadLinksByFile => deadLinksByFile.deadLinks.length > 0));
