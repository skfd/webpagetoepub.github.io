import convertPageToEPUB from 'html2epub';
import { requestTextContent, loadFileFrom } from './load_url';

const REVOKE_URL_TIME_MILISECONDS = 1000 * 60 * 30;

const formElement = document.getElementById('form');
const downloadButton = document.querySelector('button[type=submit]') as HTMLInputElement;
let progressBarElement: Element = null;
let output: Element = null;

formElement.onsubmit = (event: Event) => {
  event.preventDefault();
  disableButton();

  const inputUrlElement = document.getElementById('url') as HTMLInputElement;
  const url = inputUrlElement.value;

  const main = document.querySelector('main') as Element;
  if (progressBarElement === null) {
    progressBarElement = document.createElement('progress');
    main.appendChild(progressBarElement as Element);
  }

  if (output !== null) {
    output.remove();
  }
  output = document.createElement('output');
  main.appendChild(output);

  convertPageToEPUB(
    url,
    requestTextContent(url),
    loadFileFrom,
    updateProgressStep(),
    updateProgressLength,
    {
      log: (message: string) => {
        console.log(message);
        logMessage(output, message, 'info');
      },
      error: (message: string) => {
        console.error(message);
        logMessage(output, message, 'error');
      },
    },
  ).catch((error) => {
    enableButton();

    alert(error.message);

    throw error;
  }).then(downloadEPUB);

  return false;
};

function logMessage(output: Element, message: string, type: 'info' | 'error') {
  const span = document.createElement('p');
  span.setAttribute('class', type);
  span.appendChild(document.createTextNode(message));

  output.appendChild(span);
}

function downloadEPUB({title, epub}: {title: string, epub: Blob}) {
  const basename = slug(title);
  const url = URL.createObjectURL(epub);
  const link = document.createElement('a');
  link.href = url;
  link.textContent = 'Download EPUB';
  link.download = basename + '.epub';

  document.body.appendChild(link);
  link.click();
  link.remove();

  enableButton();

  setTimeout(() => URL.revokeObjectURL(url), REVOKE_URL_TIME_MILISECONDS);
}

function disableButton() {
  downloadButton.disabled = true;
}

function enableButton() {
  downloadButton.disabled = false;
}

function slug(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-');
}

function updateProgressLength(maxValue: number) {
  (progressBarElement as Element).setAttribute('max', maxValue.toString());
}

function updateProgressStep() {
  let currentValue = 0;

  return () => {
    currentValue++;
    (progressBarElement as Element).setAttribute('value', currentValue.toString());
  }
}
