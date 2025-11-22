import { jsPDF } from "jspdf";
// @ts-ignore
import html2canvas from "html2canvas";
import { Message, VocabularyItem } from "../types";

// --- Helper: Create Temporary PDF Container ---
const createTempContainer = () => {
  const container = document.createElement('div');
  // Use fixed positioning with negative z-index. 
  // We keep it 'on-screen' (top: 0, left: 0) but hidden behind everything
  // to ensure browsers render the fonts correctly before capture.
  container.style.position = 'fixed';
  container.style.left = '0';
  container.style.top = '0';
  container.style.zIndex = '-9999';
  container.style.width = '800px'; 
  container.style.backgroundColor = '#ffffff';
  container.style.padding = '40px';
  
  // CRITICAL: Explicitly set fonts and RESET spacing to prevent html2canvas artifacts
  container.style.fontFamily = '"Noto Sans Myanmar", "Noto Sans JP", "Plus Jakarta Sans", sans-serif';
  container.style.fontSize = '14px';
  container.style.lineHeight = '1.8';
  container.style.letterSpacing = 'normal'; // Fixes disjointed Myanmar text
  container.style.fontVariantLigatures = 'none'; // Simplifies text rendering
  container.style.textRendering = 'geometricPrecision';
  container.style.setProperty('-webkit-font-smoothing', 'antialiased');
  
  container.className = 'text-slate-800'; 
  document.body.appendChild(container);
  return container;
};

const generatePDFFromElement = async (element: HTMLElement, filename: string) => {
  try {
    // 1. Force wait for fonts to be ready
    await document.fonts.ready;
    // 2. Add delay to ensure layout and font shaping are stable
    await new Promise(resolve => setTimeout(resolve, 800));

    const canvas = await html2canvas(element, { 
      scale: 3, // Increased scale for clearer text
      useCORS: true,
      logging: false,
      allowTaint: true,
      backgroundColor: '#ffffff',
      windowWidth: 800,
      onclone: (clonedDoc) => {
          const clonedBody = clonedDoc.body;
          
          // Force styles on the cloned container root
          const rootDiv = clonedBody.firstChild as HTMLElement;
          if (rootDiv) {
            rootDiv.style.fontFamily = '"Noto Sans Myanmar", "Noto Sans JP", "Plus Jakarta Sans", sans-serif';
            rootDiv.style.letterSpacing = 'normal';
          }

          // Aggressively force fonts on all text elements in the clone
          // This ensures no child element reverts to a default browser font
          const allElements = clonedBody.getElementsByTagName('*');
          for(let i = 0; i < allElements.length; i++) {
             const el = allElements[i] as HTMLElement;
             if (el.innerText && el.innerText.trim().length > 0) {
                 // Preserve existing font family preference but ensure our fonts are present
                 const computed = window.getComputedStyle(el);
                 if (!computed.fontFamily.includes('Myanmar') && !computed.fontFamily.includes('JP')) {
                    el.style.fontFamily = '"Noto Sans Myanmar", "Noto Sans JP", "Plus Jakarta Sans", sans-serif';
                 }
                 el.style.letterSpacing = 'normal';
             }
          }
      }
    });
    
    const imgData = canvas.toDataURL('image/jpeg', 0.98); // High quality JPEG
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgProps = pdf.getImageProperties(imgData);
    const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;
    
    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeight);
    heightLeft -= pdfHeight;

    while (heightLeft > 0) {
      position -= pdfHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeight);
      heightLeft -= pdfHeight;
    }

    pdf.save(filename);
  } catch (e) {
    console.error("PDF Generation Error:", e);
    alert("Sorry, there was an error generating the PDF.");
  } finally {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
  }
};

const escapeHtml = (unsafe: string) => {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

// --- Chat History Exports ---
export const exportToPDF = async (messages: Message[]) => {
  const container = createTempContainer();
  const htmlContent = `
    <div class="flex flex-col gap-6 font-mixed">
      <div class="border-b-2 border-slate-200 pb-4 mb-4">
        <h1 class="text-3xl font-bold text-sakura-600 mb-2 font-jp">Nihongo Learning with WPS</h1>
        <p class="text-slate-500 text-sm font-mm">Lesson History • ${new Date().toLocaleDateString()}</p>
      </div>
      ${messages.map(msg => `
        <div class="flex flex-col gap-2 ${msg.role === 'user' ? 'items-end' : 'items-start'}">
          <div class="text-xs font-bold uppercase tracking-wider text-slate-400">
            ${msg.role === 'user' ? 'You' : 'Sensei'}
          </div>
          <div class="p-4 rounded-2xl border ${
            msg.role === 'user' 
              ? 'bg-slate-800 text-white border-slate-800' 
              : 'bg-white border-slate-200 text-slate-800'
          } max-w-[90%] text-sm leading-relaxed whitespace-pre-wrap font-mixed">
            ${msg.text.replace(/\n/g, '<br/>')}
          </div>
        </div>
      `).join('')}
      <div class="mt-8 pt-4 border-t border-slate-200 text-center text-xs text-slate-400">
        Generated by Nihongo Learning with WPS
      </div>
    </div>
  `;
  container.innerHTML = htmlContent;
  await generatePDFFromElement(container, "nihongo_lesson_history.pdf");
};

export const exportToCSV = (messages: Message[]) => {
  let csvContent = "data:text/csv;charset=utf-8,";
  csvContent += "Role,Message,Timestamp\n";
  messages.forEach((msg) => {
    const safeText = `"${msg.text.replace(/"/g, '""')}"`;
    const date = new Date(msg.timestamp).toLocaleString();
    csvContent += `${msg.role},${safeText},"${date}"\n`;
  });
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", "nihongo_lesson.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportToTXT = (messages: Message[]) => {
  let content = "Nihongo Learning with WPS Log\n===================================\n\n";
  messages.forEach((msg) => {
    const role = msg.role === 'user' ? "User" : "Sensei";
    const date = new Date(msg.timestamp).toLocaleString();
    content += `[${date}] ${role}:\n${msg.text}\n\n-----------------------------------\n\n`;
  });
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "nihongo_lesson.txt";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// --- Vocabulary Exports ---
export const exportVocabToPDF = async (vocabList: VocabularyItem[]) => {
  const container = createTempContainer();
  const htmlContent = `
    <div class="flex flex-col font-mixed">
      <div class="text-center mb-8">
        <h1 class="text-3xl font-bold text-sakura-600 mb-2 font-jp">Vocabulary List</h1>
        <p class="text-slate-500 font-mm text-sm">ဝေါဟာရများ လေ့ကျင့်ရန်</p>
      </div>
      <table class="w-full border-collapse text-left text-sm">
        <thead>
          <tr class="bg-slate-100 border-b-2 border-slate-300">
            <th class="p-4 font-bold text-slate-700 uppercase tracking-wider">Kanji</th>
            <th class="p-4 font-bold text-slate-700 uppercase tracking-wider">Kana</th>
            <th class="p-4 font-bold text-slate-700 uppercase tracking-wider">Romaji</th>
            <th class="p-4 font-bold text-slate-700 uppercase tracking-wider">Meaning</th>
          </tr>
        </thead>
        <tbody>
          ${vocabList.map((item, i) => `
            <tr class="${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'} border-b border-slate-200">
              <td class="p-4 font-jp font-bold text-xl text-slate-800 align-top">${item.kanji}</td>
              <td class="p-4 font-jp text-slate-600 font-medium align-top pt-5">${item.kana || '-'}</td>
              <td class="p-4 font-mono text-slate-500 font-medium align-top pt-5">${item.romaji}</td>
              <td class="p-4 font-mm text-slate-700 align-top pt-5 leading-relaxed">${item.meanings}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="mt-8 text-center text-xs text-slate-400">
        Generated by Nihongo Learning with WPS
      </div>
    </div>
  `;
  container.innerHTML = htmlContent;
  await generatePDFFromElement(container, "vocabulary_list.pdf");
};

export const exportVocabToCSV = (vocabList: VocabularyItem[]) => {
  let csvContent = "data:text/csv;charset=utf-8,";
  csvContent += "Kanji,Kana,Romaji,Meaning\n";
  vocabList.forEach((item) => {
    const safeKanji = `"${item.kanji.replace(/"/g, '""')}"`;
    const safeKana = `"${(item.kana || '').replace(/"/g, '""')}"`;
    const safeRomaji = `"${item.romaji.replace(/"/g, '""')}"`;
    const safeMeaning = `"${item.meanings.replace(/"/g, '""')}"`;
    csvContent += `${safeKanji},${safeKana},${safeRomaji},${safeMeaning}\n`;
  });
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", "vocabulary_list.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportVocabToTXT = (vocabList: VocabularyItem[]) => {
  let content = "Vocabulary List\n===============\n\n";
  vocabList.forEach((item) => {
    const kanaStr = item.kana ? ` [${item.kana}]` : '';
    content += `${item.kanji}${kanaStr} (${item.romaji}) - ${item.meanings}\n`;
  });
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "vocabulary_list.txt";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// --- Anki Export ---
export const exportVocabToAnki = (vocabList: VocabularyItem[]) => {
  // Anki High-Fidelity Import Format
  // Fields: Front, Back, Tags
  
  // 1. File Header for Anki
  let content = "#separator:tab\n#html:true\n#tags column:3\n";
  
  // 2. CSS Styling for the Card (Embedded in the Back field wrapper)
  // Note: We inject simple inline styles to ensure it looks good in Anki default
  
  vocabList.forEach((item) => {
    // --- FRONT (Kanji) ---
    const kanji = `<div style="font-size: 40px; font-family: 'Noto Sans JP', sans-serif; font-weight: bold; color: #1f2937; text-align: center;">${escapeHtml(item.kanji)}</div>`;
    
    // --- BACK (Kana + Meaning) ---
    const kanaHtml = item.kana 
      ? `<div style="font-size: 24px; color: #db2777; margin-bottom: 10px; text-align: center;">${escapeHtml(item.kana)}</div>` 
      : '';
      
    const romajiHtml = `<div style="font-size: 14px; color: #9ca3af; margin-bottom: 15px; font-family: monospace; text-align: center;">${escapeHtml(item.romaji)}</div>`;
    
    const meaningHtml = `<div style="font-size: 18px; color: #4b5563; line-height: 1.6; border-top: 1px solid #e5e7eb; padding-top: 15px; text-align: center;">${escapeHtml(item.meanings).replace(/(\r\n|\n|\r)/gm, "<br>")}</div>`;
    
    const back = `${kanaHtml}${romajiHtml}${meaningHtml}`;
    
    // --- TAGS ---
    const tags = "NihongoWPS";

    // Output: Front [TAB] Back [TAB] Tags
    content += `${kanji}\t${back}\t${tags}\n`;
  });

  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  // We use .txt because it is the most reliable Import format for Anki.
  // Users can rename to .csv if they prefer, but .txt is standard for Anki Import.
  link.download = "nihongo_anki_deck.txt";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};