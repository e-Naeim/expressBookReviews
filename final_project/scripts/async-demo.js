const { getAllBooks, getBookByISBN, getBooksByAuthor, getBooksByTitle } = require('../router/general');

async function main() {
  // Promise.all demonstrates independent concurrent requests without blocking.
  const [allBooks, byISBN, byAuthor, byTitle] = await Promise.all([
    getAllBooks(), getBookByISBN('1'), getBooksByAuthor('Unknown'), getBooksByTitle('Things Fall Apart')
  ]);
  console.log(JSON.stringify({ allBooks, byISBN, byAuthor, byTitle }, null, 2));
}
main().catch(error => {
  console.error(`Axios demo failed: ${error.message}`);
  process.exitCode = 1;
});
