
document.addEventListener('DOMContentLoaded', async (event) => {
var url = '/static/js/helloworld.pdf';

pdfjsLib.GlobalWorkerOptions.workerSrc = "./static/js/pdfjs-dist/build/pdf.worker.mjs";

//
// Asynchronous download PDF
//
const loadingTask = pdfjsLib.getDocument(url);
const pdf = await loadingTask.promise;

//
// Fetch the first page
//
const page = await pdf.getPage(1);
const scale = 1.5;
const viewport = page.getViewport({ scale });

// Support HiDPI-screens.
const outputScale = window.devicePixelRatio || 1;

//
// Prepare canvas using PDF page dimensions
//
const canvas = document.getElementById("the-canvas");
const context = canvas.getContext("2d");

canvas.width = Math.floor(viewport.width * outputScale);
canvas.height = Math.floor(viewport.height * outputScale);
canvas.style.width = Math.floor(viewport.width) + "px";
canvas.style.height = Math.floor(viewport.height) + "px";

const transform = outputScale !== 1
  ? [outputScale, 0, 0, outputScale, 0, 0]
  : null;

//
// Render PDF page into canvas context
//
const renderContext = {
  canvasContext: context,
  transform,
  viewport,
};
page.render(renderContext);

});






// let pdfDoc = null,
//   pageNum = 1,
//   pageIsRendering = false,
//   pageNumIsPending = null;

// const scale = 1.5,
//   canvas = document.querySelector('#pdf-render');
//   // ERRORED: ctx = canvas.getContext('2d');

// // Render the page
// const renderPage = num => {
//   pageIsRendering = true;

//   // Get page
//   pdfDoc.getPage(num).then(page => {
//     // Set scale
//     const viewport = page.getViewport({ scale });
//     canvas.height = viewport.height;
//     canvas.width = viewport.width;

//     const renderCtx = {
//       canvasContext: ctx,
//       viewport
//     };

//     page.render(renderCtx).promise.then(() => {
//       pageIsRendering = false;

//       if (pageNumIsPending !== null) {
//         renderPage(pageNumIsPending);
//         pageNumIsPending = null;
//       }
//     });

//     // Output current page
//     document.querySelector('#page-num').textContent = num;
//   });
// };

// // Check for pages rendering
// const queueRenderPage = num => {
//   if (pageIsRendering) {
//     pageNumIsPending = num;
//   } else {
//     renderPage(num);
//   }
// };

// // Show Prev Page
// const showPrevPage = () => {
//   if (pageNum <= 1) {
//     return;
//   }
//   pageNum--;
//   queueRenderPage(pageNum);
// };

// // Show Next Page
// const showNextPage = () => {
//   if (pageNum >= pdfDoc.numPages) {
//     return;
//   }
//   pageNum++;
//   queueRenderPage(pageNum);
// };

// // Get Document
// pdfjsLib
//   .getDocument(url)
//   .promise.then(pdfDoc_ => {
//     pdfDoc = pdfDoc_;

//     document.querySelector('#page-count').textContent = pdfDoc.numPages;

//     renderPage(pageNum);
//   })
//   .catch(err => {
//     // Display error
//     const div = document.createElement('div');
//     div.className = 'error';
//     div.appendChild(document.createTextNode(err.message));
//     document.querySelector('body').insertBefore(div, canvas);
//     // Remove top bar
//     document.querySelector('.top-bar').style.display = 'none';
//   });

// // Button Events
// document.querySelector('#prev-page').addEventListener('click', showPrevPage);
// document.querySelector('#next-page').addEventListener('click', showNextPage);


// var url = '/static/js/helloworld.pdf';


//     // The next button click event
//     document.getElementById("next").addEventListener("click", async () => {

//         if (currentPage < maxPage) {

//             // Get the next page
//             await getPage(doc, currentPage++);

//             // Display the page number
//             document.getElementById("pageNumber").innerHTML = `Page ${currentPage} of ${maxPage}`;

//         }

//     });

// })();


// async function getPage(doc, pageNumber) {

//     if (pageNumber >= 1 && pageNumber <= doc._pdfInfo.numPages) {

//         // Fetch the page
//         const page = await doc.getPage(pageNumber);

//         // Set the viewport
//         const viewport = page.getViewport({ scale: 1.5 });

//         // Set the canvas dimensions to the PDF page dimensions
//         const canvas = document.getElementById("canvas");
//         const context = canvas.getContext("2d");
//         canvas.height = viewport.height;
//         canvas.width = viewport.width;

//         // Render the PDF page into the canvas context
//         return await page.render({
//             canvasContext: context,
//             viewport: viewport
//         }).promise;

//     } else {
//         console.log("Please specify a valid page number");
//     }

// }


// if (!pdfjsLib.getDocument || !pdfjsViewer.PDFPageView) {
//   // eslint-disable-next-line no-alert
//   alert("Please build the pdfjs-dist library using\n  `gulp dist-install`");
// }

// // The workerSrc property shall be specified.
// //
// pdfjsLib.GlobalWorkerOptions.workerSrc =
//   "../../node_modules/pdfjs-dist/build/pdf.worker.mjs";

// // Some PDFs need external cmaps.
// //
// const CMAP_URL = "../../node_modules/pdfjs-dist/cmaps/";
// const CMAP_PACKED = true;

// const DEFAULT_URL = "../../web/compressed.tracemonkey-pldi-09.pdf";
// const PAGE_TO_VIEW = 1;
// const SCALE = 1.0;

// const ENABLE_XFA = true;

// const container = document.getElementById("pageContainer");

// const eventBus = new pdfjsViewer.EventBus();

// // Loading document.
// const loadingTask = pdfjsLib.getDocument({
//   url: DEFAULT_URL,
//   cMapUrl: CMAP_URL,
//   cMapPacked: CMAP_PACKED,
//   enableXfa: ENABLE_XFA,
// });

// const pdfDocument = await loadingTask.promise;
// // Document loaded, retrieving the page.
// const pdfPage = await pdfDocument.getPage(PAGE_TO_VIEW);

// // Creating the page view with default parameters.
// const pdfPageView = new pdfjsViewer.PDFPageView({
//   container,
//   id: PAGE_TO_VIEW,
//   scale: SCALE,
//   defaultViewport: pdfPage.getViewport({ scale: SCALE }),
//   eventBus,
// });
// // Associate the actual page with the view, and draw it.
// pdfPageView.setPdfPage(pdfPage);
// pdfPageView.draw();

// let x = pdfjsLib;
// console.log(x);