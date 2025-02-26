'use strict';

// Define some pseudo module globals
var isPro = require('../libs/debug').isPro;
var isDev = require('../libs/debug').isDev;
var isDbg = require('../libs/debug').isDbg;

//
var pkg = require('../package.json');

var fs = require('fs');
var async = require('async');
var git = require('git-rev');

var renderMd = require('../libs/markdown').renderMd;
var statusCodePage = require('../libs/templateHelpers').statusCodePage;
var pageMetadata = require('../libs/templateHelpers').pageMetadata;

var modelParser = require('../libs/modelParser');

exports.view = function (aReq, aRes, aNext) {
  //
  var authedUser = aReq.session.user;
  var options = {};

  var document = aReq.params.document;
  var documentPath = null;

  var tasks = null;
  var then = null;

  // Session
  authedUser = options.authedUser = modelParser.parseUser(authedUser);
  options.isMod = authedUser && authedUser.isMod;
  options.isAdmin = authedUser && authedUser.isAdmin;


  if (document) {
    documentPath = 'views/includes/documents';

    //--- Tasks
    tasks = [
      // Read file listing
      function (aCallback) {
        fs.readdir(documentPath, function (aErr, aFiles) {
          if (aErr) {
            aCallback({ statusCode: 500, statusMessage : 'Error retrieving page list' });
            return;
          }

          var file = null;

          // Dynamically create a file listing of the pages
          options.files = [];
          for (file in aFiles) {
            if (/\.md$/.test(aFiles[file])) {
              options.files.push({
                href: aFiles[file].replace(/\.md$/, ''),
                textContent: aFiles[file].replace(/\.md$/, '').replace(/-/g, ' ')
              });
            }
          }

          aCallback(null);
        });
      },
      // Read md file contents
      function (aCallback) {
        fs.readFile(documentPath + '/' + document + '.md', 'utf8', function (aErr, aData) {
          if (aErr) {
            aCallback({ statusCode: 404, statusMessage: 'Error retrieving page' });
            return;
          }

          var lines = null;
          var matches = null;
          var heading = null;
          var content = null;

          // Check if first line is h2 and use for title/heading if present
          lines = aData.split('\n');
          matches = lines[0].match(/^##\s(.*)$/);
          if (matches) {
            heading = lines.shift().replace(/^##\s+/, "");
          } else {
            heading = document;
          }
          content = lines.join('\n');

          // Page metadata
          pageMetadata(options, [heading, 'About']);

          options.pageHeading = heading;
          options.pageData = renderMd(content);

          aCallback(null);
        });
      }
    ];
  }
  else {
    // Page metadata
    pageMetadata(options, ['About', 'About']);

    options.isAbout = true;

    options.process = {};
    if (options.isAdmin) {
      options.process.version = process.version;
    }

    then = new Date(Date.now() - parseInt(process.uptime() * 1000, 10));
    options.lastRestart = then.toLocaleString();

    options.pkg = {};
    options.pkg.name = pkg.name;
    options.pkg.version = pkg.version.replace(/\+.*$/, '');

    options.git = {};
    //--- Tasks
    tasks = [
      // Read git short hash HEAD for current tree
      function (aCallback) {
        git.short(function (aStr) {
          options.git.short = aStr;

          aCallback(null);
        });
      },

      // Read git branch name of current tree
      function (aCallback) {
        git.branch(function (aStr) {
          options.git.branch = aStr;

          aCallback(null);
        });
      }
    ];
  }

  //---
  async.waterfall(tasks, function (aErr) {
    if (aErr) {
      return statusCodePage(aReq, aRes, aNext, {
        statusCode: aErr.statusCode,
        statusMessage: aErr.statusMessage
      });
    }

    aRes.render('pages/documentPage', options);
  });
};
