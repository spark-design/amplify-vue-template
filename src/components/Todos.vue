<script setup lang="ts">
import '@/assets/main.css';
import { onMounted, ref, reactive } from 'vue';
import type { Schema } from '../../amplify/data/resource';
import { generateClient } from 'aws-amplify/data';

const client = generateClient<Schema>();

// create a reactive reference to the array of trips
const trips = ref<Array<Schema['Trip']["type"]>>([]);
const newTrip = reactive({
  destination: '',
  startDate: '',
  endDate: '',
  budget: 0,
  notes: '',
  status: 'PLANNED' as const,
  // Additional booking details
  flight: {
    airline: '',
    flightNumber: '',
    departureTime: '',
    price: 0,
    booked: false
  },
  hotel: {
    name: '',
    checkIn: '',
    checkOut: '',
    price: 0,
    booked: false
  }
});
const showForm = ref(false);
const activeTab = ref('details');

function listTrips() {
  client.models.Trip.observeQuery().subscribe({
    next: ({ items, isSynced }) => {
      trips.value = items;
    },
  }); 
}

function createTrip() {
  // Prepare notes with flight and hotel info if they're booked
  let tripNotes = newTrip.notes || '';
  
  if (newTrip.flight.booked) {
    tripNotes += `\n\nFLIGHT:\nAirline: ${newTrip.flight.airline}\nFlight: ${newTrip.flight.flightNumber}\nDeparture: ${newTrip.flight.departureTime}\nPrice: ${newTrip.flight.price}`;
  }
  
  if (newTrip.hotel.booked) {
    tripNotes += `\n\nHOTEL:\nName: ${newTrip.hotel.name}\nCheck-in: ${newTrip.hotel.checkIn}\nCheck-out: ${newTrip.hotel.checkOut}\nPrice: ${newTrip.hotel.price}`;
  }
  
  // Update status if flight or hotel is booked
  const tripStatus = (newTrip.flight.booked || newTrip.hotel.booked) ? 'BOOKED' : newTrip.status;
  
  client.models.Trip.create({
    destination: newTrip.destination,
    startDate: newTrip.startDate,
    endDate: newTrip.endDate,
    budget: newTrip.budget,
    notes: tripNotes,
    status: tripStatus
  }).then(() => {
    // Reset form and hide it
    newTrip.destination = '';
    newTrip.startDate = '';
    newTrip.endDate = '';
    newTrip.budget = 0;
    newTrip.notes = '';
    newTrip.status = 'PLANNED' as const;
    newTrip.flight = {
      airline: '',
      flightNumber: '',
      departureTime: '',
      price: 0,
      booked: false
    };
    newTrip.hotel = {
      name: '',
      checkIn: '',
      checkOut: '',
      price: 0,
      booked: false
    };
    showForm.value = false;
    activeTab.value = 'details';
    
    // After creating a new trip, update the list
    listTrips();
  });
}

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString();
}

function getStatusClass(status: string | null | undefined): string {
  switch(status) {
    case 'PLANNED': return 'status-planned';
    case 'BOOKED': return 'status-booked';
    case 'COMPLETED': return 'status-completed';
    case 'CANCELLED': return 'status-cancelled';
    default: return '';
  }
}

// Helper functions for parsing booking details
function hasBookings(notes: string): boolean {
  return notes.includes('FLIGHT:') || notes.includes('HOTEL:');
}

function hasFlightBooking(notes: string): boolean {
  return notes.includes('FLIGHT:');
}

function hasHotelBooking(notes: string): boolean {
  return notes.includes('HOTEL:');
}

function hasNotes(notes: string): boolean {
  // Check if there's content before the FLIGHT: or HOTEL: sections
  const firstBooking = Math.min(
    notes.indexOf('FLIGHT:') >= 0 ? notes.indexOf('FLIGHT:') : Infinity,
    notes.indexOf('HOTEL:') >= 0 ? notes.indexOf('HOTEL:') : Infinity
  );
  
  return firstBooking > 0 && notes.substring(0, firstBooking).trim().length > 0;
}

function extractNotes(notes: string): string {
  const firstBooking = Math.min(
    notes.indexOf('FLIGHT:') >= 0 ? notes.indexOf('FLIGHT:') : Infinity,
    notes.indexOf('HOTEL:') >= 0 ? notes.indexOf('HOTEL:') : Infinity
  );
  
  return firstBooking < Infinity ? notes.substring(0, firstBooking).trim() : notes;
}

function extractFlightDetails(notes: string): string {
  if (!hasFlightBooking(notes)) return '';
  
  const flightStart = notes.indexOf('FLIGHT:');
  const hotelStart = notes.indexOf('HOTEL:');
  
  if (hotelStart > flightStart) {
    return notes.substring(flightStart + 7, hotelStart).trim();
  } else {
    return notes.substring(flightStart + 7).trim();
  }
}

function extractHotelDetails(notes: string): string {
  if (!hasHotelBooking(notes)) return '';
  
  const hotelStart = notes.indexOf('HOTEL:');
  return notes.substring(hotelStart + 6).trim();
}
    
// fetch trips when the component is mounted
onMounted(() => {
  listTrips();
});
</script>

<template>
  <main>
    <h1>✈️ Travel Booking System</h1>
    <button @click="showForm = !showForm" class="new-trip-btn">
      {{ showForm ? 'Cancel' : '+ New Trip' }}
    </button>
    
    <div v-if="showForm" class="trip-form">
      <h2>Add New Trip</h2>
      
      <div class="form-tabs">
        <button 
          @click="activeTab = 'details'" 
          :class="['tab-btn', activeTab === 'details' ? 'active' : '']">
          Trip Details
        </button>
        <button 
          @click="activeTab = 'flight'" 
          :class="['tab-btn', activeTab === 'flight' ? 'active' : '']">
          Flight
        </button>
        <button 
          @click="activeTab = 'hotel'" 
          :class="['tab-btn', activeTab === 'hotel' ? 'active' : '']">
          Hotel
        </button>
      </div>
      
      <!-- Trip Details Tab -->
      <div v-if="activeTab === 'details'" class="tab-content">
        <div class="form-group">
          <label for="destination">Destination:</label>
          <input id="destination" v-model="newTrip.destination" required />
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label for="startDate">Start Date:</label>
            <input id="startDate" type="date" v-model="newTrip.startDate" />
          </div>
          
          <div class="form-group">
            <label for="endDate">End Date:</label>
            <input id="endDate" type="date" v-model="newTrip.endDate" />
          </div>
        </div>
        
        <div class="form-group">
          <label for="budget">Budget ($):</label>
          <input id="budget" type="number" v-model="newTrip.budget" />
        </div>
        
        <div class="form-group">
          <label for="notes">Notes:</label>
          <textarea id="notes" v-model="newTrip.notes"></textarea>
        </div>
        
        <div class="form-group">
          <label for="status">Status:</label>
          <select id="status" v-model="newTrip.status">
            <option value="PLANNED">Planned</option>
            <option value="BOOKED">Booked</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>
      
      <!-- Flight Tab -->
      <div v-if="activeTab === 'flight'" class="tab-content">
        <div class="booking-header">
          <h3>Flight Booking</h3>
          <label class="toggle-container">
            <input type="checkbox" v-model="newTrip.flight.booked">
            <span class="toggle-slider"></span>
            <span class="toggle-label">{{ newTrip.flight.booked ? 'Booked' : 'Not Booked' }}</span>
          </label>
        </div>
        
        <div class="form-group">
          <label for="airline">Airline:</label>
          <input id="airline" v-model="newTrip.flight.airline" :disabled="!newTrip.flight.booked" />
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label for="flightNumber">Flight Number:</label>
            <input id="flightNumber" v-model="newTrip.flight.flightNumber" :disabled="!newTrip.flight.booked" />
          </div>
          
          <div class="form-group">
            <label for="departureTime">Departure Time:</label>
            <input id="departureTime" type="datetime-local" v-model="newTrip.flight.departureTime" :disabled="!newTrip.flight.booked" />
          </div>
        </div>
        
        <div class="form-group">
          <label for="flightPrice">Price ($):</label>
          <input id="flightPrice" type="number" v-model="newTrip.flight.price" :disabled="!newTrip.flight.booked" />
        </div>
      </div>
      
      <!-- Hotel Tab -->
      <div v-if="activeTab === 'hotel'" class="tab-content">
        <div class="booking-header">
          <h3>Hotel Booking</h3>
          <label class="toggle-container">
            <input type="checkbox" v-model="newTrip.hotel.booked">
            <span class="toggle-slider"></span>
            <span class="toggle-label">{{ newTrip.hotel.booked ? 'Booked' : 'Not Booked' }}</span>
          </label>
        </div>
        
        <div class="form-group">
          <label for="hotelName">Hotel Name:</label>
          <input id="hotelName" v-model="newTrip.hotel.name" :disabled="!newTrip.hotel.booked" />
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label for="checkIn">Check-in Date:</label>
            <input id="checkIn" type="date" v-model="newTrip.hotel.checkIn" :disabled="!newTrip.hotel.booked" />
          </div>
          
          <div class="form-group">
            <label for="checkOut">Check-out Date:</label>
            <input id="checkOut" type="date" v-model="newTrip.hotel.checkOut" :disabled="!newTrip.hotel.booked" />
          </div>
        </div>
        
        <div class="form-group">
          <label for="hotelPrice">Price ($):</label>
          <input id="hotelPrice" type="number" v-model="newTrip.hotel.price" :disabled="!newTrip.hotel.booked" />
        </div>
      </div>
      
      <div class="form-actions">
        <button @click="createTrip" class="save-btn">Save Trip</button>
        <button @click="activeTab = activeTab === 'details' ? 'flight' : activeTab === 'flight' ? 'hotel' : 'details'" class="next-btn">
          {{ activeTab === 'hotel' ? 'Back to Details' : 'Next' }}
        </button>
      </div>
    </div>
    
    <div v-if="trips.length === 0" class="no-trips">
      No trips planned yet. Add your first vacation!
    </div>
    
    <div v-else class="trip-cards">
      <div 
        v-for="trip in trips" 
        :key="trip.id"
        class="trip-card">
        <div class="trip-header">
          <h3>{{ trip.destination }}</h3>
          <span :class="['status-badge', getStatusClass(trip.status)]">{{ trip.status }}</span>
        </div>
        <div class="trip-dates">
          <span>{{ formatDate(trip.startDate || '') }} - {{ formatDate(trip.endDate || '') }}</span>
        </div>
        <div class="trip-budget">Budget: ${{ trip.budget }}</div>
        
        <div class="trip-bookings" v-if="hasBookings(trip.notes || '')">
          <div class="booking-icons">
            <span v-if="hasFlightBooking(trip.notes || '')" class="booking-icon flight-icon" title="Flight booked">✈️</span>
            <span v-if="hasHotelBooking(trip.notes || '')" class="booking-icon hotel-icon" title="Hotel booked">🏨</span>
          </div>
        </div>
        
        <div class="trip-notes" v-if="trip.notes">
          <div v-if="!hasBookings(trip.notes)" class="notes-content">{{ trip.notes }}</div>
          <div v-else class="booking-details">
            <div v-if="hasFlightBooking(trip.notes)" class="flight-details">
              <h4>Flight Details</h4>
              <pre>{{ extractFlightDetails(trip.notes) }}</pre>
            </div>
            <div v-if="hasHotelBooking(trip.notes)" class="hotel-details">
              <h4>Hotel Details</h4>
              <pre>{{ extractHotelDetails(trip.notes) }}</pre>
            </div>
            <div v-if="hasNotes(trip.notes)" class="notes-content">
              <h4>Notes</h4>
              {{ extractNotes(trip.notes) }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
main {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

h1 {
  color: #2c3e50;
  margin-bottom: 20px;
}

.new-trip-btn {
  background-color: #42b983;
  color: white;
  border: none;
  padding: 10px 15px;
  border-radius: 4px;
  cursor: pointer;
  margin-bottom: 20px;
}

.trip-form {
  background-color: #f5f5f5;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.form-group {
  margin-bottom: 15px;
}

.form-row {
  display: flex;
  gap: 15px;
}

.form-row .form-group {
  flex: 1;
}

label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
}

input, select, textarea {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

textarea {
  height: 80px;
}

.save-btn {
  background-color: #2c3e50;
  color: white;
  border: none;
  padding: 10px 15px;
  border-radius: 4px;
  cursor: pointer;
}

.trip-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 20px;
}

.trip-card {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 15px;
  background-color: white;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.trip-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.trip-header h3 {
  margin: 0;
  font-size: 18px;
}

.status-badge {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: bold;
}

.status-planned {
  background-color: #e0f7fa;
  color: #006064;
}

.status-booked {
  background-color: #e8f5e9;
  color: #1b5e20;
}

.status-completed {
  background-color: #e3f2fd;
  color: #0d47a1;
}

.status-cancelled {
  background-color: #ffebee;
  color: #b71c1c;
}

.trip-dates {
  color: #666;
  margin-bottom: 10px;
}

.trip-budget {
  font-weight: bold;
  margin-bottom: 10px;
}

.trip-bookings {
  margin-bottom: 10px;
}

.booking-icons {
  display: flex;
  gap: 10px;
}

.booking-icon {
  font-size: 18px;
}

.trip-notes {
  font-size: 14px;
  color: #666;
  white-space: pre-wrap;
  border-top: 1px solid #eee;
  padding-top: 10px;
  margin-top: 10px;
}

.booking-details h4 {
  margin: 10px 0 5px;
  color: #2c3e50;
  font-size: 15px;
}

.flight-details, .hotel-details {
  background-color: #f9f9f9;
  padding: 8px;
  border-radius: 4px;
  margin-bottom: 10px;
}

.flight-details pre, .hotel-details pre {
  margin: 0;
  white-space: pre-wrap;
  font-family: inherit;
}

.notes-content {
  margin-top: 10px;
}

.no-trips {
  text-align: center;
  padding: 40px;
  color: #666;
  font-style: italic;
}

.form-tabs {
  display: flex;
  margin-bottom: 20px;
  border-bottom: 1px solid #ddd;
}

.tab-btn {
  padding: 10px 15px;
  background: none;
  border: none;
  cursor: pointer;
  font-weight: bold;
  color: #666;
}

.tab-btn.active {
  color: #42b983;
  border-bottom: 2px solid #42b983;
}

.tab-content {
  padding: 10px 0;
}

.booking-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.booking-header h3 {
  margin: 0;
}

.toggle-container {
  display: flex;
  align-items: center;
  cursor: pointer;
}

.toggle-slider {
  position: relative;
  display: inline-block;
  width: 40px;
  height: 20px;
  background-color: #ccc;
  border-radius: 20px;
  margin-right: 8px;
  transition: all 0.3s;
}

.toggle-container input {
  display: none;
}

.toggle-container input:checked + .toggle-slider {
  background-color: #42b983;
}

.toggle-slider:before {
  position: absolute;
  content: "";
  height: 16px;
  width: 16px;
  left: 2px;
  bottom: 2px;
  background-color: white;
  border-radius: 50%;
  transition: all 0.3s;
}

.toggle-container input:checked + .toggle-slider:before {
  transform: translateX(20px);
}

.toggle-label {
  font-size: 14px;
  font-weight: bold;
}

.form-actions {
  display: flex;
  justify-content: space-between;
  margin-top: 20px;
}

.next-btn {
  background-color: #2c3e50;
  color: white;
  border: none;
  padding: 10px 15px;
  border-radius: 4px;
  cursor: pointer;
  opacity: 0.8;
}
</style>
