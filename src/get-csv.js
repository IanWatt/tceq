require('dotenv').config()

//get date from STDIN?

const fs = require('fs'),
      puppeteer = require('puppeteer'),
      { TCEQ_URL } = process.env;

//move to ENV/STDIN?
const sites = [
  'Karnes County',
  'Camp Bullis', //SA
  'Dallas Hinton St',
  'Houston Milby Park'
];

function debug(message) {
  console.log(message);
}

(async () => {
  debug('Launching puppeteer');
  const browser = await puppeteer.launch({ headless: false });
  debug('Creating new page');
  const page = await browser.newPage();
  debug('Visiting URL');
  await page.goto(TCEQ_URL);

  // Find the form controls
  debug('Fetching data');
  //maybe do this as an interator instead - it has to run synchronously anyway
  //that way, the next site wouldn't be called until the data for the previous
  //site is captured.
  const data = await Promise.all(sites.map(site => getSite(page, site/*,date*/)));

  console.log(data[3]);
  console.log(data.length)

  setTimeout(() => {
    browser.close();
  }, 5000)
})();

async function getSite(page, site, date) {
  const data = await Promise.all([
    page.evaluate(setReportParameters, { site, date }),
    page.waitForNavigation().then(() => page.evaluate(getCSV))
  ]);

  return data[1]; //csv data
}

function setReportParameters({ site, date }) {
  alert(site)
  const siteSelect = document.querySelector('select[name="user_site"]'),
        options = Array.from(siteSelect.querySelectorAll('option')),
        optionIndex = options.findIndex(option => option.textContent.includes(site)),
        chooseCSV = document.querySelector('input[value="comma"]'),
        generateReport = document.querySelector('input[value="Generate Report"]');
    
    document.querySelector('form').scrollIntoView();
    chooseCSV.click();
    siteSelect.selectedIndex = optionIndex;
    generateReport.click();

    //select date

  return null;
}

function getCSV() {
  document.querySelector('pre').scrollIntoView();
  return document.querySelector('pre').innerHTML;
}