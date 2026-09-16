const fs = require('fs');

const mockDataStorePath = 'lib/mock-data-store.ts';
let storeContent = fs.readFileSync(mockDataStorePath, 'utf8');

// Replace the arrays with empty arrays
storeContent = storeContent.replace(/g\.companiesStore = g\.companiesStore \|\| \[[\s\S]*?\];/g, 'g.companiesStore = g.companiesStore || [];');
storeContent = storeContent.replace(/g\.clientsStore = g\.clientsStore \|\| \[[\s\S]*?\];/g, 'g.clientsStore = g.clientsStore || [];');
storeContent = storeContent.replace(/g\.suppliersStore = g\.suppliersStore \|\| \[[\s\S]*?\];/g, 'g.suppliersStore = g.suppliersStore || [];');
storeContent = storeContent.replace(/g\.productsStore = g\.productsStore \|\| \[[\s\S]*?\];/g, 'g.productsStore = g.productsStore || [];');
storeContent = storeContent.replace(/g\.quotationsStore = g\.quotationsStore \|\| \[[\s\S]*?\];/g, 'g.quotationsStore = g.quotationsStore || [];');
storeContent = storeContent.replace(/g\.invoicesStore = g\.invoicesStore \|\| \[[\s\S]*?\];/g, 'g.invoicesStore = g.invoicesStore || [];');

fs.writeFileSync(mockDataStorePath, storeContent, 'utf8');
console.log('Cleared mock-data-store.ts');

const mockDataPath = 'lib/mock-data.ts';
let mockDataContent = fs.readFileSync(mockDataPath, 'utf8');

// Replace arrays in mock-data.ts
const arraysToClear = [
  'revenuMensuel', 'repartitionStatuts', 'facturesRecentes',
  'clientsRecents', 'clientsList', 'facturesList', 'devisList',
  'produitsList', 'bonsCommandeList', 'posCategories',
  'avoirsList', 'bulletinsList', 'employesList', 'depensesList',
  'equipeList'
];

arraysToClear.forEach(arrName => {
  const regex1 = new RegExp(`export const ${arrName}:.*?= \\[([\\s\\S]*?)\\];`, 'g');
  const regex2 = new RegExp(`export const ${arrName} = \\[([\\s\\S]*?)\\];`, 'g');
  
  if (mockDataContent.match(regex1)) {
    mockDataContent = mockDataContent.replace(regex1, `export const ${arrName}: any[] = [];`);
  } else if (mockDataContent.match(regex2)) {
    mockDataContent = mockDataContent.replace(regex2, `export const ${arrName}: any[] = [];`);
  }
});

fs.writeFileSync(mockDataPath, mockDataContent, 'utf8');
console.log('Cleared mock-data.ts');
