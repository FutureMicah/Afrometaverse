/**
 * Building System
 * Defines all buildings in Port Harcourt with interior rooms, NPCs, and interactions
 */

export type RoomKind = "market_floor" | "storage" | "office" | "dining" | "bar" | "hotel_lobby" | "hotel_room" | "dock" | "warehouse" | "factory_floor" | "classroom" | "hallway" | "reception" | "prayer_hall" | "community_room" | "clinic_reception" | "consultation_room" | "pharmacy" | "courtyard";

export type NPCRole = "vendor" | "customer" | "worker" | "manager" | "security" | "cleaner" | "receptionist" | "staff" | "captain" | "driver" | "elder" | "teacher" | "doctor" | "nurse" | "priest" | "imam" | "organizer";

export interface Room {
  id: string;
  name: string;
  kind: RoomKind;
  description: string;
  exits: string[]; // Room IDs you can move to
  npcIds: string[]; // NPCs present in this room
  activities: string[]; // What you can do here
  items?: string[]; // Tradeable/usable items
}

export interface Building {
  id: string;
  name: string;
  district: string;
  kind: "market" | "hotel" | "office" | "residential" | "clinic" | "religious" | "education" | "transport" | "industry";
  description: string;
  operatingHours: {
    open: number; // 24-hour format, e.g., 6 for 6am
    close: number; // 24-hour format, e.g., 22 for 10pm
  };
  rooms: Room[];
  entranceRoomId: string; // Which room is the entrance
  status: "open" | "busy" | "closed";
  weatherSensitive?: boolean; // Affected by flooding, weather
}

export interface NPC {
  id: string;
  name: string;
  role: NPCRole;
  district: string;
  building?: string; // Home building
  routine: {
    [hour: number]: {
      building: string;
      room: string;
    };
  };
  personality: string;
  dialogue: {
    [topic: string]: string[];
  };
  inventory: {
    [goodId: string]: number;
  };
  relationships: {
    [npcId: string]: number; // -100 to 100
  };
  reputation: number;
  story?: string;
}

export interface Vehicle {
  id: string;
  type: "taxi" | "bus" | "ferry" | "motorcycle" | "truck" | "car";
  name: string;
  driverId: string; // NPC who operates it
  currentLocation: string; // District or building
  capacity: number;
  passengers: string[]; // Player + other NPCs aboard
  cost: number; // Per trip or per km
  travelTime: number; // Minutes between districts
  status: "available" | "occupied" | "maintenance" | "weather_delay";
  route?: {
    from: string;
    to: string;
    departTime: number;
    arrivalTime: number;
  };
}

// ============================================
// BUILDINGS DEFINITION
// ============================================

export const MILE_ONE_MARKET: Building = {
  id: "mile1-market",
  name: "Mile 1 Market",
  district: "town-market",
  kind: "market",
  description: "A dense row of stalls where food, clothing, household goods and quick deals change hands all day.",
  operatingHours: { open: 5, close: 21 },
  rooms: [
    {
      id: "mile1-entrance",
      name: "Market Entrance",
      kind: "market_floor",
      description: "Chaotic energy. Vendors calling out, people weaving between stalls, the smell of food and commerce.",
      exits: ["mile1-produce", "mile1-textiles", "mile1-food"],
      npcIds: ["mama-nkechi", "chioma-hawker", "porter-babs"],
      activities: ["Buy goods", "Haggle prices", "Hire help", "Work as porter"],
      items: ["rice", "beans", "plantain", "fish"],
    },
    {
      id: "mile1-produce",
      name: "Produce Section",
      kind: "market_floor",
      description: "Vegetables, fruits, grains piled in basins. The air is thick with agricultural life.",
      exits: ["mile1-entrance", "mile1-storage"],
      npcIds: ["farmer-john", "mama-blessing"],
      activities: ["Buy produce", "Negotiate bulk deals", "Learn market prices"],
      items: ["plantain", "yam", "cassava", "okra", "pepper"],
    },
    {
      id: "mile1-textiles",
      name: "Textile Stalls",
      kind: "market_floor",
      description: "Bolts of Ankara, lace, imported fabrics. Tailors and seamstresses work in corners.",
      exits: ["mile1-entrance"],
      npcIds: ["textile-mama", "tailor-ade"],
      activities: ["Browse fabrics", "Order tailoring", "Trade cloth"],
      items: ["ankara", "lace", "cotton"],
    },
    {
      id: "mile1-food",
      name: "Food Stalls",
      kind: "market_floor",
      description: "Hot stoves, sizzling suya, boiling pots of soup. The smell is intoxicating.",
      exits: ["mile1-entrance"],
      npcIds: ["mama-ngo", "bole-seller", "pepper-soup-mama"],
      activities: ["Eat", "Buy for later", "Chat with vendors", "Work as server"],
      items: ["suya", "bole", "pepper-soup", "bread"],
    },
    {
      id: "mile1-storage",
      name: "Back Storage",
      kind: "storage",
      description: "Stacked boxes, sacks of grain, organized chaos. Only vendors and staff come here.",
      exits: ["mile1-produce"],
      npcIds: ["warehouse-chief"],
      activities: ["Work loading", "Store goods", "Manage inventory"],
      items: [],
    },
  ],
  entranceRoomId: "mile1-entrance",
  status: "busy",
};

export const CREEK_FERRY_DOCK: Building = {
  id: "creek-ferry",
  name: "Creek Ferry Dock",
  district: "creekside",
  kind: "transport",
  description: "A river crossing hub where ferries move people and goods across the creek lanes.",
  operatingHours: { open: 5, close: 20 },
  rooms: [
    {
      id: "ferry-dock-entrance",
      name: "Dock Entrance",
      kind: "dock",
      description: "Boats lined up, rope and wood smell, the sound of water lapping. People waiting to cross.",
      exits: ["ferry-waiting", "ferry-ticket"],
      npcIds: ["captain-segun", "dock-worker-tunde"],
      activities: ["Board ferry", "Buy ticket", "Look for work", "Talk to captain"],
      items: [],
    },
    {
      id: "ferry-waiting",
      name: "Waiting Area",
      kind: "hallway",
      description: "Benches where passengers wait for the next ferry. The smell of salt water and diesel.",
      exits: ["ferry-dock-entrance", "ferry-boat"],
      npcIds: [],
      activities: ["Wait", "Chat with other passengers", "Observe the water"],
      items: [],
    },
    {
      id: "ferry-ticket",
      name: "Ticket Counter",
      kind: "reception",
      description: "A small wooden booth where ferries are booked and tickets are sold.",
      exits: ["ferry-dock-entrance"],
      npcIds: ["ticket-seller-ama"],
      activities: ["Buy ticket", "Ask about schedules", "Negotiate group rates"],
      items: [],
    },
    {
      id: "ferry-boat",
      name: "Ferry Interior",
      kind: "dock",
      description: "Inside the wooden ferry. Passengers sit on benches, cargo lashed to the sides. The boat rocks gently.",
      exits: ["ferry-waiting"],
      npcIds: ["captain-segun", "deckhand-kofi"],
      activities: ["Ride", "Work as deckhand", "Chat with passengers", "Observe scenery"],
      items: [],
    },
  ],
  entranceRoomId: "ferry-dock-entrance",
  status: "busy",
  weatherSensitive: true, // Flooding affects ferry schedules
};

export const CIVIC_HALL: Building = {
  id: "city-hall",
  name: "Civic Hall",
  district: "civic-centre",
  kind: "office",
  description: "The local government and council hub for votes, permits, neighborhood updates and civic planning.",
  operatingHours: { open: 8, close: 17 },
  rooms: [
    {
      id: "civic-lobby",
      name: "Civic Hall Lobby",
      kind: "hallway",
      description: "A formal government space. Notices on the wall, people standing in lines, quiet efficiency.",
      exits: ["civic-voting", "civic-records", "civic-office"],
      npcIds: ["clerk-adeyemi"],
      activities: ["Check notices", "Ask for directions", "Register for voting"],
      items: [],
    },
    {
      id: "civic-voting",
      name: "Voting Chamber",
      kind: "office",
      description: "A simple room with voting booths and a ballot box. The heart of civic participation.",
      exits: ["civic-lobby"],
      npcIds: ["electoral-officer-musa"],
      activities: ["Cast vote", "Learn about proposals", "Ask about civic issues"],
      items: [],
    },
    {
      id: "civic-records",
      name: "Records Office",
      kind: "office",
      description: "Filing cabinets, ledgers, documents. The bureaucratic backbone of the city.",
      exits: ["civic-lobby"],
      npcIds: ["records-keeper-chioma"],
      activities: ["File permit", "Check records", "Pay fees"],
      items: [],
    },
    {
      id: "civic-office",
      name: "Administrator's Office",
      kind: "office",
      description: "The office of the civic administrator. Wood desk, window view of the district, air of authority.",
      exits: ["civic-lobby"],
      npcIds: ["administrator-chief"],
      activities: ["Schedule meeting", "Propose initiative", "Seek favor"],
      items: [],
    },
  ],
  entranceRoomId: "civic-lobby",
  status: "open",
};

export const DIOBU_CLINIC: Building = {
  id: "diobu-clinic",
  name: "Diobu Community Clinic",
  district: "town-market",
  kind: "clinic",
  description: "A neighborhood medical point where quick consultations, checkups and treatment happen.",
  operatingHours: { open: 7, close: 18 },
  rooms: [
    {
      id: "clinic-reception",
      name: "Reception",
      kind: "reception",
      description: "A small waiting area with basic furniture. A receptionist at the desk, patient files in stacks.",
      exits: ["clinic-consultation", "clinic-pharmacy"],
      npcIds: ["receptionist-ify"],
      activities: ["Sign in", "Pay consultation fee", "Wait for appointment"],
      items: [],
    },
    {
      id: "clinic-consultation",
      name: "Consultation Room",
      kind: "consultation_room",
      description: "A small room with a desk, examination table, and medical posters. Doctor Adeyemi works here.",
      exits: ["clinic-reception"],
      npcIds: ["doctor-adeyemi"],
      activities: ["Consult doctor", "Get diagnosis", "Request treatment"],
      items: [],
    },
    {
      id: "clinic-pharmacy",
      name: "Pharmacy",
      kind: "pharmacy",
      description: "Shelves of medicines, bottles, boxes. The pharmacist dispenses carefully measured doses.",
      exits: ["clinic-reception"],
      npcIds: ["pharmacist-ngozi"],
      activities: ["Buy medicine", "Ask about symptoms", "Refill prescription"],
      items: ["paracetamol", "malaria-drug", "antibiotics", "vitamin-syrup"],
    },
  ],
  entranceRoomId: "clinic-reception",
  status: "open",
};

export const OLD_GRA_HOTEL: Building = {
  id: "old-gra-hotel",
  name: "Old GRA Hotel",
  district: "civic-centre",
  kind: "hotel",
  description: "A formal accommodation and hospitality venue used by business travelers and visitors.",
  operatingHours: { open: 0, close: 24 }, // Open 24/7
  rooms: [
    {
      id: "hotel-lobby",
      name: "Hotel Lobby",
      kind: "hotel_lobby",
      description: "An elegant entrance with a reception desk, comfortable seating, and the hum of business.",
      exits: ["hotel-restaurant", "hotel-front-desk", "hotel-hallway"],
      npcIds: ["manager-chioma", "bellhop-tunde"],
      activities: ["Check in", "Ask for room", "Hire porter", "Use facilities"],
      items: [],
    },
    {
      id: "hotel-front-desk",
      name: "Front Desk",
      kind: "reception",
      description: "The check-in counter where reservations are handled and keys are issued.",
      exits: ["hotel-lobby"],
      npcIds: ["receptionist-amara"],
      activities: ["Check in", "Check out", "Make reservation", "Pay bills"],
      items: [],
    },
    {
      id: "hotel-restaurant",
      name: "Restaurant",
      kind: "dining",
      description: "A dining area with tables, the smell of cooked food, waiters in uniform moving efficiently.",
      exits: ["hotel-lobby"],
      npcIds: ["chef-bola", "waiter-kofi"],
      activities: ["Eat", "Order meal", "Socialize", "Work as server"],
      items: ["breakfast", "lunch", "dinner"],
    },
    {
      id: "hotel-hallway",
      name: "Hallway - First Floor",
      kind: "hallway",
      description: "A corridor with numbered doors. Quiet and orderly. The sound of distant conversations.",
      exits: ["hotel-lobby", "hotel-room-101"],
      npcIds: [],
      activities: ["Walk", "Explore", "Look for room"],
      items: [],
    },
    {
      id: "hotel-room-101",
      name: "Room 101",
      kind: "hotel_room",
      description: "A modest but clean hotel room. Bed, toilet, shower. A safe space away from the city noise.",
      exits: ["hotel-hallway"],
      npcIds: [],
      activities: ["Sleep", "Store goods", "Rest", "Think"],
      items: [],
    },
  ],
  entranceRoomId: "hotel-lobby",
  status: "open",
};

// ============================================
// NPC DEFINITIONS
// ============================================

export const NPCS: Record<string, NPC> = {
  "mama-nkechi": {
    id: "mama-nkechi",
    name: "Mama Nkechi",
    role: "vendor",
    district: "town-market",
    building: "mile1-market",
    routine: {
      5: { building: "mile1-market", room: "mile1-entrance" },
      6: { building: "mile1-market", room: "mile1-produce" },
      12: { building: "mile1-market", room: "mile1-food" },
      14: { building: "mile1-market", room: "mile1-produce" },
      21: { building: "residential-diobu", room: "home-nkechi" },
    },
    personality: "Strict but fair. Speaks with authority. Loves haggling but respects honest negotiation.",
    dialogue: {
      greeting: ["Eh! Welcome to my stall! What do you want today?", "Good morning! Come, come. Fresh produce just arrived."],
      prices: ["Those are my prices. No negotiation for newcomers.", "You want better price? Buy plenty then we talk."],
      work: ["You look strong. Can you help me move these basins? 150 coins."],
      gossip: ["Did you hear about the new ferry captain? Young and careless!"],
    },
    inventory: {
      plantain: 50,
      yam: 30,
      cassava: 40,
      pepper: 25,
    },
    relationships: {
      "chioma-hawker": 50,
      "farmer-john": 80,
      "porter-babs": 60,
    },
    reputation: 85,
  },

  "captain-segun": {
    id: "captain-segun",
    name: "Captain Segun",
    role: "captain",
    district: "creekside",
    building: "creek-ferry",
    routine: {
      5: { building: "creek-ferry", room: "ferry-dock-entrance" },
      6: { building: "creek-ferry", room: "ferry-boat" },
      20: { building: "creek-ferry", room: "ferry-dock-entrance" },
      22: { building: "residential-creekside", room: "home-segun" },
    },
    personality: "Experienced, weather-wise, patient with passengers. Loves his boat like a child.",
    dialogue: {
      greeting: ["Welcome aboard! Careful on the boat. Water is strong today."],
      work: ["We need a deckhand for the evening crossing. You interested? 180 coins."],
      weather: ["Tide is high. We'll make good time today. No flooding concerns."],
      safety: ["Life jacket under your seat. River demands respect."],
    },
    inventory: {
      "ferry-ticket": 100,
    },
    relationships: {
      "deckhand-kofi": 90,
      "ticket-seller-ama": 75,
    },
    reputation: 92,
  },

  "chioma-hawker": {
    id: "chioma-hawker",
    name: "Chioma",
    role: "vendor",
    district: "town-market",
    building: "mile1-market",
    routine: {
      6: { building: "mile1-market", room: "mile1-entrance" },
      8: { building: "mile1-market", room: "mile1-textiles" },
      14: { building: "mile1-market", room: "mile1-entrance" },
      18: { building: "residential-diobu", room: "home-chioma" },
    },
    personality: "Young, energetic, fast talker. Always has the latest gossip and best deals.",
    dialogue: {
      greeting: ["Hey! Looking for fabrics? I have the best prices!"],
      prices: ["For you, special price today. But you have to decide now!"],
      gossip: ["Did you hear? There's talk of new policies coming. Market might change."],
    },
    inventory: {
      ankara: 20,
      lace: 15,
      cotton: 25,
    },
    relationships: {
      "mama-nkechi": 50,
      "tailor-ade": 70,
    },
    reputation: 65,
  },

  "doctor-adeyemi": {
    id: "doctor-adeyemi",
    name: "Doctor Adeyemi",
    role: "doctor",
    district: "town-market",
    building: "diobu-clinic",
    routine: {
      7: { building: "diobu-clinic", room: "clinic-consultation" },
      12: { building: "diobu-clinic", room: "clinic-reception" },
      18: { building: "residential-diobu", room: "home-doctor" },
    },
    personality: "Compassionate, knowledgeable, sometimes frustrated by shortages of medicine.",
    dialogue: {
      greeting: ["Hello, what brings you to the clinic today?"],
      diagnosis: ["Let me examine you. Tell me your symptoms."],
      medicine: ["I'm afraid we're out of that medicine today. Check back tomorrow."],
      payment: ["Consultation is 500 coins. Do you have insurance?"],
    },
    inventory: {
      "medical-supplies": 100,
    },
    relationships: {
      "pharmacist-ngozi": 85,
    },
    reputation: 88,
  },
};

// ============================================
// VEHICLE DEFINITIONS
// ============================================

export const VEHICLES: Record<string, Vehicle> = {
  "taxi-james": {
    id: "taxi-james",
    type: "taxi",
    name: "Taxi - Yellow Cab",
    driverId: "driver-james",
    currentLocation: "town-market",
    capacity: 4,
    passengers: [],
    cost: 300,
    travelTime: 25,
    status: "available",
  },

  "ferry-segun": {
    id: "ferry-segun",
    type: "ferry",
    name: "Ferry - Segun's Boat",
    driverId: "captain-segun",
    currentLocation: "creekside",
    capacity: 50,
    passengers: [],
    cost: 200,
    travelTime: 30,
    status: "available",
    weatherSensitive: true,
  },

  "bus-express": {
    id: "bus-express",
    type: "bus",
    name: "Bus - Express Route",
    driverId: "driver-kunle",
    currentLocation: "town-market",
    capacity: 20,
    passengers: [],
    cost: 150,
    travelTime: 35,
    status: "available",
  },

  "okada-bola": {
    id: "okada-bola",
    type: "motorcycle",
    name: "Okada - Bola's Bike",
    driverId: "okada-bola",
    currentLocation: "civic-centre",
    capacity: 2,
    passengers: [],
    cost: 400,
    travelTime: 15,
    status: "available",
  },
};
