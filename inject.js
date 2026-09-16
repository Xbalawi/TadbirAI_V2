const fs = require('fs');

let content = fs.readFileSync('lib/mock-data-store.ts', 'utf-8');

const importStatement = import fs from 'fs';\nimport path from 'path';\n\nconst DATA_FILE = path.join(process.cwd(), 'data.json');\n\n;

const persistenceFunctions = 
const syncRef = (target, source) => {
  target.length = 0;
  target.push(...source);
};

export const loadData = () => {
  if (g.__dataLoaded) return;
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
      if (data.companiesStore) syncRef(g.companiesStore, data.companiesStore);
      if (data.clientsStore) syncRef(g.clientsStore, data.clientsStore);
      if (data.suppliersStore) syncRef(g.suppliersStore, data.suppliersStore);
      if (data.productsStore) syncRef(g.productsStore, data.productsStore);
      if (data.quotationsStore) syncRef(g.quotationsStore, data.quotationsStore);
      if (data.invoicesStore) syncRef(g.invoicesStore, data.invoicesStore);
      if (data.employeesStore) syncRef(g.employeesStore, data.employeesStore);
      if (data.avoirsStore) syncRef(g.avoirsStore, data.avoirsStore);
      if (data.depensesStore) syncRef(g.depensesStore, data.depensesStore);
      if (data.bulletinsStore) syncRef(g.bulletinsStore, data.bulletinsStore);
      if (data.bonsCommandeStore) syncRef(g.bonsCommandeStore, data.bonsCommandeStore);
      if (data.equipeStore) syncRef(g.equipeStore, data.equipeStore);
    }
  } catch (err) {
    console.error("Error loading data.json", err);
  }
  g.__dataLoaded = true;
};

export const saveData = () => {
  try {
    const data = {
      companiesStore: g.companiesStore || [],
      clientsStore: g.clientsStore || [],
      suppliersStore: g.suppliersStore || [],
      productsStore: g.productsStore || [],
      quotationsStore: g.quotationsStore || [],
      invoicesStore: g.invoicesStore || [],
      employeesStore: g.employeesStore || [],
      avoirsStore: g.avoirsStore || [],
      depensesStore: g.depensesStore || [],
      bulletinsStore: g.bulletinsStore || [],
      bonsCommandeStore: g.bonsCommandeStore || [],
      equipeStore: g.equipeStore || [],
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error("Error writing data.json", err);
  }
};
;

// Insert imports and functions
if (!content.includes("import fs from")) {
    content = importStatement + content;
    // Insert after let idCounter = 1;
    content = content.replace(/(const generateUniqueId = .*?;)/, "\n\n" + persistenceFunctions + "\nloadData();\n");
    
    // Inject saveData() in mutators. 
    // Mutators usually end with "return newX;", "return true;" or "};"
    // Let's systematically inject saveData() before return statements inside mutator arrows.
    // Instead of regex, we can just find array mutations!
    content = content.replace(/(Store\.push\(.*?\);)/g, " saveData();");
    content = content.replace(/(Store\.splice\(.*?\);)/g, " saveData();");
    content = content.replace(/(Object\.assign\(.*?, patch\);)/g, " saveData();");
    content = content.replace(/(Store\.length = 0;)/g, " saveData();");
    
    fs.writeFileSync('lib/mock-data-store.ts', content);
    console.log("Persistence logic injected successfully!");
} else {
    console.log("Already injected.");
}
