require('dotenv').config()
const moment = require('moment');
const puppeteer = require('puppeteer');
const fs = require('fs');
const readlineSync = require('readline-sync');

const { TCEQ_URL } = process.env,
      defaultDate = moment().subtract(2, 'days').toISOString().split('T')[0],
      defaultDays = 1,
      date = readlineSync.question(`What date do you want to start from ? (${defaultDate}) `) || defaultDate,
      days = readlineSync.question(`How many days do you want to go back? (${defaultDays}) `) || defaultDays,
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
  const browser = await puppeteer.launch({ headless: false });

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
  function findOptionIndex(select, predicate) {
    return Array.from(select.querySelectorAll('option')).findIndex(predicate);
  }

  document.querySelector('select').scrollIntoView({ behavior: 'smooth'});

  const siteSelect = document.querySelector('select[name="user_site"]'),
        optionIndex = findOptionIndex(siteSelect, o => o.label.includes(site)),
        chooseCSV = document.querySelector('input[value="comma"]'),
        generateReport = document.querySelector('input[value="Generate Report"]');
    
    document.querySelector('form').scrollIntoView();
    chooseCSV.click();

    //select site
    siteSelect.selectedIndex = optionIndex;

    //select date    
    const [ year, month, day ] = date.split('-'),
          selectYear = document.querySelector('select[name="user_year"]'),          
          selectMonth = document.querySelector('select[name="user_month"]'),
          selectDay = document.querySelector('select[name="user_day"]'),
          yearIndex = findOptionIndex(selectYear, o => o.label === year),
          monthIndex = +month - 1,
          dayIndex = findOptionIndex(selectDay, o => o.label === day);

    selectYear.selectedIndex = yearIndex;
    selectMonth.selectedIndex = monthIndex;
    selectDay.selectedIndex = dayIndex;

    setTimeout(() => generateReport.click(), 500);    

  return null;
}

function getCSV() {
  document.querySelector('pre').scrollIntoView();
  return document.querySelector('pre').innerHTML;
}
