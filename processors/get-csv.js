const moment = require('moment');
const puppeteer = require('puppeteer');
const fs = require('fs');
const readlineSync = require('readline-sync');

const TCEQ_URL = 'https://www.tceq.texas.gov/cgi-bin/compliance/monops/agc_daily_summary.pl',
      defaultDate = moment().subtract(2, 'days').toISOString().split('T')[0],
      defaultDays = 1,
      date = readlineSync.question(
        `What date do you want to start from ? (${defaultDate}) `
      ) || defaultDate,
      days = readlineSync.question(
        `How many days do you want to go back? (${defaultDays}) `
      ) || defaultDays,
      dates = getDates(moment(date), days),
      sites = [
        //search, alias
        ['Karnes County', 'Karnes'],
        ['Camp Bullis', 'San Antonio'],
        ['Dallas Hinton St', 'Dallas'],
        ['Houston Milby Park', 'Houston']
      ],
      queries = getQueries(sites, dates);

function getDates(date = moment().subtract(1, 'days'), days = 1) {
  const dates = [];
  if (days < 1) return dates;
  while (days > 0) {
    dates.push(date.toISOString().split('T')[0]);
    date.subtract(1, 'days');
    days--;
  }
  return dates;
}

function getQueries(sites, dates) {
  const queries = [];
  sites.forEach(site => {
    dates.forEach(date => queries.push({ site, date }));
  });
  return queries;
}

function debug(message) {
  console.log(message);
}

(async () => {
  debug('Launching puppeteer');
  const browser = await puppeteer.launch({ headless: true });

  debug('Creating new page');
  const page = await browser.newPage();
  
  debug('Visiting URL');
  await page.goto(TCEQ_URL);

  debug('Fetching data');
  const data = await performQueries(page, queries);

  debug('Writing Data');
  data.forEach(({ site, data, date }) => {
    fs.writeFileSync(`data/${site}, ${date}.csv`, data)
  });

  browser.close();
})();

async function performQueries(page, queries, results = [], index = 0) {
  if (index >= queries.length) return results;
  const { site, date } = queries[index],
        [ search, alias ] = site;
  console.log(`Getting ${alias} (${date})`);
  const data = await getSite(page, search, date);
  results.push({ site: alias, date, data });
  return performQueries(page, queries, results, index + 1);
}

async function getSite(page, site, date) {
  const data = await Promise.all([
    page.evaluate(setReportParameters, { site, date }),
    page.waitForNavigation().then(() => page.evaluate(getCSV))
  ]);

  return data[1]; //csv data
}

function setReportParameters({ site, date }) {
  const get = selector => document.querySelector(selector);

  function selectOption(selector, predicate) {
    const select = get(selector);
    const optionIndex = Array.from(select.querySelectorAll('option'))
      .findIndex(predicate);
    select.selectedIndex = optionIndex;
  }  

  //get('form').scrollIntoView(); //uncomment for non-headless mode

  //specify options
  get('input[value="comma"]').click(); //choose csv format
  get('input[value="user"]').click(); //use custom date
    //this only has to be done on the first page, b/c "today" is also an option
    //but this input exists (but is hidden) on subsequent page loads

  //select site
  selectOption('select[name="user_site"]', o => o.label.includes(site))

  //select date    
  const [ year, month, day ] = date.split('-');
  selectOption('select[name="user_year"]', o => o.label === year);
  selectOption('select[name="user_month"]', (o, i) => i === +month - 1);
  selectOption('select[name="user_day"]', o => o.label === day);

  return get('input[value="Generate Report"]').click();
}

function getCSV() {
  return document.querySelector('pre').innerHTML;
}
