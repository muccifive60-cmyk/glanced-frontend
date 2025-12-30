import fs from "fs";

// ==========================================
// CONFIGURATION: BATCH 3 (THE "ELITE" BATCH)
// ==========================================
// Target: US & European Critical Infrastructure
// Quantity: 300,000 Agents (Total will reach ~820k)
// Start Index: 520,001 (Continuing from previous batch)
const TOTAL_AGENTS = 300000; 
const START_INDEX = 520001; 
const FILENAME = "agents_300k_eu_us_critical.csv"; 

// ==========================================
// DATASETS: CRITICAL WESTERN SECTORS
// ==========================================
const categories = [
  "NATO Defense Logistics", // Security
  "EU Green Deal Compliance", // Climate Law
  "Wall Street Fraud Detection", // Finance
  "NHS Patient Data Logistics", // Healthcare (UK)
  "GDPR & CCPA Privacy Shield", // Global Law
  "Silicon Valley IP Protection", // Tech Legal
  "Offshore Wind Farm Control", // Renewable Energy
  "Federal Reserve Economic Model", // US Gov Economy
  "Bio-Tech Vaccine Research", // Pharma
  "Cybersecurity Zero-Trust Arch", // Cyber Warfare
  "SpaceX Orbital Navigation", // Space Tech
  "Brexit Customs Automation" // Trade Logistics
];

// Names that sound authoritative and corporate
const adjectives = [
  "Sovereign", "Federal", "Global", "Strategic", "Tactical", "Prime", 
  "Certified", "Autonomous", "Neural", "Cyber", "Quantum", "Rapid", 
  "Secure", "Integrated", "Advanced", "Elite", "Capital"
];

const nouns = [
  "Sentinel", "Auditor", "Controller", "Architect", "Strategist", 
  "Guardian", "Intelligence", "Navigator", "Specialist", "Monitor", 
  "Validator", "Consultant", "Officer", "Engine", "Director"
];

// Locations & Standards to make it look authentic to Western Buyers
const standards = [
  "ISO-27001 Certified", "GDPR Compliant", "HIPAA Approved", 
  "SEC Regulated", "NATO Standard", "FDA Cleared", "Basel III Ready"
];

const images = [
  "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=300&h=300&fit=crop", 
  "https://images.unsplash.com/photo-1573164713988-8665fc963095?w=300&h=300&fit=crop", 
  "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=300&h=300&fit=crop", 
  "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=300&h=300&fit=crop", 
  "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=300&h=300&fit=crop"
];

// ==========================================
// GENERATION LOGIC
// ==========================================
const stream = fs.createWriteStream(FILENAME);

stream.write("name,description,price,provider,category,image_url\n");

console.log(`🚀 Generating 300k ELITE Agents (US/EU Focused) starting from ID ${START_INDEX}...`);

for (let i = 0; i < TOTAL_AGENTS; i++) {
  const currentID = START_INDEX + i; 
  
  const adj = adjectives[i % adjectives.length];
  const noun = nouns[i % nouns.length];
  const category = categories[i % categories.length];
  const standard = standards[i % standards.length];
  const image = images[i % images.length];

  // 1. Name: "Federal Sentinel 520001"
  const name = `${adj} ${noun} ${currentID}`;
  
  // 2. Description: Solving Critical Issues
  const description = `Enterprise AI for ${category}. Fully ${standard}. Solves complex regulatory and operational challenges in US/EU markets.`;
  
  // 3. Price: High Ticket ($299 - $5000)
  const price = (299 + (i % 4700)); 
  const provider = "Vapi";

  const row = `${name},"${description}",${price},${provider},${category},${image}\n`;
  stream.write(row);

  if (i % 50000 === 0) console.log(`✅ Progress: ${i.toLocaleString()} / ${TOTAL_AGENTS.toLocaleString()} agents generated.`);
}

stream.end();
console.log(`🎉 DONE! File '${FILENAME}' is ready. Designed for US/EU Markets.`);
