const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');

// Read the original DOCX
const inputPath = path.join(__dirname, '../../debug/debug1/Legito_Vendor_Exit_Strategy.docx');
const outputPath = path.join(__dirname, '../../debug/debug1/Legito_Vendor_Exit_Strategy_EN.docx');

const zip = new AdmZip(inputPath);
let docXml = zip.getEntry('word/document.xml').getData().toString('utf-8');

// Paragraph-by-paragraph translations (Czech -> Business English)
// EXACT matches from debug output - including trailing punctuation
const paragraphTranslations = {
  // P2
  'Základní principy a přístup k ukončení služby':
    'Fundamental Principles and Approach to Service Termination',

  // P3
  'Legito je poskytováno jako SaaS řešení. V případě ukončení spolupráce se zákazníky platí následující principy:':
    'Legito is provided as a SaaS solution. In the event of termination of cooperation with customers, the following principles apply:',

  // P4
  'Kontinuita provozu: Službu a podporu budeme poskytovat v plném sjednaném rozsahu po celou dobu trvání platné licence, tj. až do sjednaného data ukončení, a to za podmínek sjednaných individuálně s každým zákazníkem. Nejsou-li sjednány, tak za podmínek dle obchodních podmínek naší společnosti.':
    'Operational Continuity: We will provide service and support in full agreed scope throughout the valid license period, i.e., until the agreed termination date, under conditions individually negotiated with each customer. If not individually negotiated, terms shall be governed by our company\'s general terms and conditions.',

  // P5
  'Kontrola nad daty na straně zákazníka: zákazník má po celou dobu trvání licence možnost stahovat nebo mazat svá data přes rozhraní Legito API (a to v rozsahu dle technických možností podporovaných verzí REST API za níže uvedených podmínek). Zákazník má dále možnost využít standardních funkcí aplikace prostřednictvím uživatelského rozhraní ke stažení nebo smazání svých dat z aplikace Legito.':
    'Customer Data Control: The customer has the ability to download or delete their data via the Legito API interface throughout the license period (to the extent permitted by technical capabilities of supported REST API versions under the conditions specified below). The customer also has the option to use standard application functions via the user interface to download or delete their data from the Legito application.',

  // P6
  'Bezpečné ukončení: Po ukončení licence, případně dříve dle pokynu zákazníka, budou veškerá data zákazníka z našich databází bezpečně odstraněna v souladu s platnou smluvní a legislativní úpravou.':
    'Secure Termination: Upon license termination, or earlier upon the customer\'s instruction, all customer data will be securely removed from our databases in accordance with applicable contractual and legislative provisions.',

  // P7
  'Podpora při přechodu: V rámci standardní podpory neposkytujeme specificky podporu pro přechod, avšak lze ji samostatně sjednat.':
    'Transition Support: As part of standard support, we do not specifically provide transition support; however, it can be separately negotiated.',

  // P8
  'Harmonogram a klíčové milníky':
    'Timeline and Key Milestones',

  // P9
  'Legito umožňuje zákazníkům data průběžně exportovat prostřednictvím API a/nebo uživatelského rozhraní v průběhu celé doby trvání licence. Vzhledem ke skutečnosti, že Legito je velice přizpůsobitelná aplikace, je každá implementace individuální. Proto je třeba harmonogram sjednat individuálně s dostatečným předstihem.':
    'Legito enables customers to continuously export data via API and/or user interface throughout the entire license period. Given that Legito is a highly customizable application, each implementation is unique. Therefore, the timeline must be negotiated individually with sufficient advance notice.',

  // P10
  'Způsob předání zdrojových kódů a dokumentace':
    'Method of Handover of Source Codes and Documentation',

  // P11
  'Aplikace Legito (SaaS)':
    'Legito Application (SaaS)',

  // P12 - ends with comma
  'Zdrojové kódy k aplikaci Legito nejsou součástí dodávky a nejsou předávány třetí straně,':
    'Source codes for the Legito application are not part of the delivery and are not transferred to third parties,',

  // P13 - ends with comma
  'Základní dokumentace k API je veřejně dostupná (např. popis REST rozhraní, struktury objektů apod.), zákazník od nás obdrží odkaz a potřebné informace pro integrace,':
    'Basic API documentation is publicly available (e.g., REST interface description, object structures, etc.), the customer will receive from us a link and necessary information for integrations,',

  // P14 - with URL and period
  'API dokumentace: https://app.swaggerhub.com/apis-docs/LegitoAPI/legito-api/7.':
    'API Documentation: https://app.swaggerhub.com/apis-docs/LegitoAPI/legito-api/7.',

  // P15
  'Low-code skripty uvnitř Legita':
    'Low-code Scripts within Legito',

  // P16 - ends with comma
  'V rámci řešení mohou být vytvořeny skripty v low-code prostředí přímo v aplikaci Legito,':
    'As part of the solution, scripts may be created in the low-code environment directly in the Legito application,',

  // P17 - ends with comma
  'Tyto skripty je možné vykopírovat prostřednictvím uživatelského rozhraní aplikace přímo zákazníky. Mohou tak mít funkci jako podklad pro konfiguraci či implementaci v novém systému. Pravděpodobně však nebudou pro nový systém funkční sami o sobě, neboť vychází z funkcí a architektury aplikace Legito,':
    'These scripts can be copied via the application\'s user interface directly by customers. They can serve as a basis for configuration or implementation in a new system. However, they will likely not be functional for the new system on their own, as they are based on the functions and architecture of the Legito application,',

  // P18 - with URL and period
  'Více informací k Low-code skriptům: https://www.legito.com/knowledge-base/legito-documentation/.':
    'More information on Low-code Scripts: https://www.legito.com/knowledge-base/legito-documentation/.',

  // P19
  'Vývoj mimo aplikaci Legito':
    'Development Outside the Legito Application',

  // P20 - ends with period
  'Je-li součásti služeb vývoj na míru mimo aplikaci Legito, např. middleware na samostatném serveru, propojený s aplikací Legito prostřednictvím API a taková samostatná aplikace slouží pouze pro konkrétního zákazníka, jsme v případě ukončení spolupráce připraveni předat zdrojový kód této aplikace včetně technické dokumentace, aby nový dodavatel mohl plynule navázat.':
    'If custom development outside the Legito application is part of the services, e.g., middleware on a separate server connected to the Legito application via API, and such standalone application serves only a specific customer, we are prepared, in the event of termination of cooperation, to hand over the source code of this application including technical documentation, so that a new supplier can seamlessly continue.',

  // P21
  'Technický a organizační postup předání služby jinému dodavateli':
    'Technical and Organizational Procedure for Service Handover to Another Supplier',

  // P22
  'Technický postup:':
    'Technical Procedure:',

  // P23
  'Zákazník nebo nový dodavatel využije Legito API a/nebo uživatelské rozhraní k:':
    'The Customer or new supplier will use the Legito API and/or user interface to:',

  // P24 - ends with comma
  'stažení instancí vygenerovaných dokumentů ve formátu Word a/nebo PDF,':
    'download instances of generated documents in Word and/or PDF format,',

  // P25 - ends with comma
  'stažení nahraných souborů do aplikace,':
    'download files uploaded to the application,',

  // P26 - ends with comma, uses " quotes
  'stažení souvisejících metadat (tj. obsah tzv. "Document Records" a "Object Records"),':
    'download related metadata (i.e., the content of so-called "Document Records" and "Object Records"),',

  // P27 - ends with comma
  'Příslušné funkce uživatelského rozhraní ke stažení "Timeline Events", tedy událostí v aplikaci,':
    'Use respective user interface functions to download "Timeline Events", i.e., events in the application,',

  // P28 - ends with comma
  'Využije náhledu prostřednictvím náhledů Legito editorů v uživatelském rozhraní pro pochopení logiky automatizovaných vzorů dokumentů a procesů,':
    'Use previews through Legito editor previews in the user interface to understand the logic of automated document templates and processes,',

  // P29 - ends with period
  'Jsou-li použité, zkopíruje si low-code skripty prostřednictvím uživatelského rozhraní (low-code skripty nejsou automatizované vzory, ale pouze jejich nástavba, která může ale nemusí být použita).':
    'If used, copy low-code scripts via the user interface (low-code scripts are not automated templates, but only their extension, which may or may not be used).',

  // P30
  'Na základě informací, souborů a dat získaných postupem podle bodu a) a případně zdrojových kódů a dokumentace k samostatným aplikacím viz. odstavec 3 bod c), může nový dodavatel:':
    'Based on information, files, and data obtained through the procedure according to point a) and possibly source codes and documentation for standalone applications (see paragraph 3 point c), the new supplier may:',

  // P31 - ends with comma
  'Reimplementovat obsah a funkce v novém řešení (bude-li to umožňovat),':
    'Reimplement content and functions in the new solution (if it allows),',

  // P32 - ends with comma
  'Napojit nový systém na datové výstupy, které si zákazník z Legita exportoval,':
    'Connect the new system to data outputs that the customer exported from Legito,',

  // P33 - ends with period
  'Nahrát získané soubory do nového systému.':
    'Upload obtained files to the new system.',

  // P34 - ends with colon
  'Definice šablon, workflow, objects a dalších podobných entit (např. "Templates", "Workflows" atd.):':
    'Template Definitions, Workflows, Objects, and Other Similar Entities (e.g., "Templates", "Workflows", etc.):',

  // P35 - ends with comma
  'Tyto konfigurace jsou úzce svázány s aplikací Legito a jsou funkční pouze v jejím prostředí,':
    'These configurations are closely tied to the Legito application and are functional only within its environment,',

  // P36 - ends with period
  'Z tohoto důvodu je nepředáváme jako přenositelný balíček, mohou však sloužit jako referenční inspirace při návrhu nového řešení (např. formou ukázky v uživatelském prostředí).':
    'For this reason, we do not transfer them as a portable package; however, they can serve as reference inspiration when designing a new solution (e.g., in the form of a demonstration in the user environment).',

  // P37
  'Odstranění dat ze systému':
    'Data Removal from the System',

  // P38 - ends with comma
  'Zákazník prostřednictvím API nebo uživatelského rozhraní odstraní všechny nahrané soubory,':
    'The Customer will remove all uploaded files via API or user interface,',

  // P39 - with URL and comma
  'Zákazník prostřednictvím API nebo uživatelského rozhraní anonymizuje veškeré Legito dokumenty. Více informací https://www.legito.com/knowledge-base/anonymization/,':
    'The Customer will anonymize all Legito documents via API or user interface. More information at https://www.legito.com/knowledge-base/anonymization/,',

  // P40 - ends with comma
  'Zákazník prostřednictvím uživatelského rozhraní odstraní všechny REST API klíče,':
    'The Customer will remove all REST API keys via the user interface,',

  // P41 - ends with comma
  'Zákazník prostřednictvím uživatelského rozhraní deaktivuje veškeré Push API (Webhooks),':
    'The Customer will deactivate all Push API (Webhooks) via the user interface,',

  // P42 - ends with comma (no period after quotes)
  'Zákazník prostřednictvím uživatelského rozhraní deaktivuje veškeré "JSON Integrations",':
    'The Customer will deactivate all "JSON Integrations" via the user interface,',

  // P43 - ends with comma
  'Zákazník prostřednictvím API nebo uživatelského rozhraní odstraní všechny uživatele z "Workspace",':
    'The Customer will remove all users from the "Workspace" via API or user interface,',

  // P44 - ends with period (has trailing space in original - trimmed)
  'Zákazník kontaktuje společnost Legito prostřednictvím helpdesku, aby provedla odstranění zbylých dat ze systému.':
    'The Customer will contact Legito via the helpdesk to perform removal of remaining data from the system.',

  // P45
  'Organizační postup:':
    'Organizational Procedure:',

  // P46 - ends with period
  'Zákazník jmenuje zodpovědnou osobu / tým pro řízení přechodu (projektový manažer, IT, business owner).':
    'The Customer will appoint a responsible person/team for transition management (project manager, IT, business owner).',

  // P47 - ends with period
  'Nebude-li sjednáno jinak, veškeré standardní požadavky související s ukončením činnosti v aplikaci Legito budou řešeny prostřednictvím Legito helpdesku.':
    'Unless otherwise agreed, all standard requests related to termination of activity in the Legito application will be handled through the Legito helpdesk.',

  // P48
  'Zajištění kontinuity provozu během přechodu':
    'Ensuring Operational Continuity During Transition',

  // P49 - ends with period
  'Legito bude poskytovat službu a podporu standardním způsobem až do data ukončení licence, aby byl zajištěn plynulý provoz stávajících procesů zákazníka.':
    'Legito will provide service and support in the standard manner until the license termination date to ensure smooth operation of the customer\'s existing processes.',

  // P50
  'Zákazník má díky API a uživatelskému prostředí možnost:':
    'Thanks to the API and user interface, the Customer has the ability to:',

  // P51 - ends with comma
  'Průběžně si data stahovat a testovat migraci v novém systému, aniž by to narušovalo běžný provoz,':
    'Continuously download data and test migration in the new system without disrupting normal operations,',

  // P52 - ends with comma
  'Samostatné aplikace a případné integrační komponenty zůstávají plně funkční do doby, než dojde k ukončení sjednané podpory,':
    'Standalone applications and any integration components remain fully functional until the agreed support is terminated,',

  // P53 - ends with period (has trailing space in original - trimmed)
  'Pro zachování kontinuity se doporučuje začít s přechodem na nový systém (ve smyslu implementace) s dostatečným předstihem před ukončením používání aplikace Legito. Aplikaci Legito doporučujeme produkčně využívat do doby, než bude nový systém dostatečně doladěn.':
    'To maintain continuity, it is recommended to begin the transition to the new system (in terms of implementation) well in advance of discontinuing the use of the Legito application. We recommend using the Legito application in production until the new system is sufficiently refined.',
};

// Helper to normalize text - replace non-breaking spaces and Czech quotes
function normalizeText(text) {
  return text
    .replace(/\u00A0/g, ' ')  // Non-breaking space -> regular space
    .replace(/\u201E/g, '"')  // U+201E Czech opening quote -> standard
    .replace(/\u201C/g, '"')  // U+201C Czech closing quote -> standard
    .replace(/\u201D/g, '"')  // U+201D right double quote -> standard
    .trim();
}

// Process paragraph by paragraph in the XML
const paragraphRegex = /(<w:p[^>]*>)([\s\S]*?)(<\/w:p>)/g;

docXml = docXml.replace(paragraphRegex, (fullMatch, openTag, content, closeTag) => {
  // Extract all text from <w:t> elements in this paragraph
  const textMatches = content.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
  const extractedText = textMatches
    .map(m => m.replace(/<w:t[^>]*>([^<]*)<\/w:t>/, '$1'))
    .join('');

  // Normalize text and check for translation
  const normalizedText = normalizeText(extractedText);
  const translation = paragraphTranslations[normalizedText];

  if (translation) {
    // Replace all text content with the translation
    // Strategy: Put all text in the first <w:t> element, empty the rest
    let isFirst = true;
    const newContent = content.replace(/<w:t([^>]*)>([^<]*)<\/w:t>/g, (match, attrs, text) => {
      if (isFirst && text.length > 0) {
        isFirst = false;
        return `<w:t${attrs}>${translation}</w:t>`;
      } else if (!isFirst) {
        return `<w:t${attrs}></w:t>`;
      }
      return match;
    });

    return openTag + newContent + closeTag;
  }

  return fullMatch;
});

// Update the DOCX
zip.updateFile('word/document.xml', Buffer.from(docXml, 'utf-8'));

// Save the new file
zip.writeZip(outputPath);
console.log('Created:', outputPath);
