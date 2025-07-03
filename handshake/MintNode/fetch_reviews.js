const appStore = require('app-store-scraper');
const fs = require('fs');

function toCSV(reviews) {
  const header = ['id', 'userName', 'title', 'text', 'score', 'date'];
  const rows = reviews.map(r => [
    r.id,
    JSON.stringify(r.userName),
    JSON.stringify(r.title),
    JSON.stringify(r.text),
    r.score,
    r.date
  ]);
  return [header.join(','), ...rows.map(row => row.join(','))].join('\n');
}

appStore.reviews({
  // id: 1010865877, // YNAB app ID
  id: 1459319842, // Monarch app ID
  country: 'us',
  sort: appStore.sort.HELPFUL,
  page: 1
}).then(reviews => {
  console.log('Raw reviews array:', reviews);
  console.log('Number of reviews fetched:', reviews.length);

  // Save reviews to a JSON file
  fs.writeFileSync('ynab_reviews.json', JSON.stringify(reviews, null, 2));
  console.log('✅ Reviews saved to ynab_reviews.json');

  // Save reviews to a CSV file
  const csv = toCSV(reviews);
  fs.writeFileSync('ynab_reviews.csv', csv);
  console.log('✅ Reviews saved to ynab_reviews.csv');
}).catch(console.error); 