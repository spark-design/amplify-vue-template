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
  status: 'PLANNED'
});
const showForm = ref(false);

function listTrips() {
  client.models.Trip.observeQuery().subscribe({
    next: ({ items, isSynced }) => {
      trips.value = items;
    },
  }); 
}

function createTrip() {
  client.models.Trip.create({
    destination: newTrip.destination,
    startDate: newTrip.startDate,
    endDate: newTrip.endDate,
    budget: newTrip.budget,
    notes: newTrip.notes,
    status: newTrip.status
  }).then(() => {
    // Reset form and hide it
    newTrip.destination = '';
    newTrip.startDate = '';
    newTrip.endDate = '';
    newTrip.budget = 0;
    newTrip.notes = '';
    newTrip.status = 'PLANNED';
    showForm.value = false;
    
    // After creating a new trip, update the list
    listTrips();
  });
}

function formatDate(dateString: string): string {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString();
}

function getStatusClass(status: string): string {
  switch(status) {
    case 'PLANNED': return 'status-planned';
    case 'BOOKED': return 'status-booked';
    case 'COMPLETED': return 'status-completed';
    case 'CANCELLED': return 'status-cancelled';
    default: return '';
  }
}
    
// fetch trips when the component is mounted
onMounted(() => {
  listTrips();
});
</script>

<template>
  <main>
    <h1>My Travel Plans</h1>
    <button @click="showForm = !showForm" class="new-trip-btn">
      {{ showForm ? 'Cancel' : '+ New Trip' }}
    </button>
    
    <div v-if="showForm" class="trip-form">
      <h2>Add New Trip</h2>
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
      
      <button @click="createTrip" class="save-btn">Save Trip</button>
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
          <span>{{ formatDate(trip.startDate) }} - {{ formatDate(trip.endDate) }}</span>
        </div>
        <div class="trip-budget">Budget: ${{ trip.budget }}</div>
        <div class="trip-notes" v-if="trip.notes">{{ trip.notes }}</div>
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

.trip-notes {
  font-size: 14px;
  color: #666;
  white-space: pre-wrap;
}

.no-trips {
  text-align: center;
  padding: 40px;
  color: #666;
  font-style: italic;
}
</style>
