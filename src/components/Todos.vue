<script setup lang="ts">
import '@/assets/main.css';
import { onMounted, ref, reactive, watch } from 'vue';
import type { Schema } from '../../amplify/data/resource';
import { generateClient } from 'aws-amplify/data';
import { uploadData, getUrl, remove } from 'aws-amplify/storage';

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
  },
  // Document storage
  documents: [] as {name: string, key: string, type: string}[]
});
const showForm = ref(false);
const activeTab = ref('details');
const uploadingFile = ref(false);
const tripImages = ref<Record<string, {name: string, key: string, url: string, type: string}[]>>({});

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
  
  // Add document information if any
  if (newTrip.documents.length > 0) {
    tripNotes += '\n\nDOCUMENTS:';
    newTrip.documents.forEach(doc => {
      tripNotes += `\n${doc.name} (${doc.key})`;
    });
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
    newTrip.documents = [];
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

// File upload functions
async function handleFileUpload(event: Event, tripId?: string) {
  const input = event.target as HTMLInputElement;
  if (!input.files || input.files.length === 0) return;
  
  const file = input.files[0];
  const fileType = file.type;
  const fileName = file.name;
  const fileKey = tripId 
    ? `trips/${tripId}/${Date.now()}-${fileName}`
    : `trips/new/${Date.now()}-${fileName}`;
  
  try {
    uploadingFile.value = true;
    
    // Upload file to S3
    await uploadData({
      key: fileKey,
      data: file,
      options: {
        contentType: fileType
      }
    });
    
    if (tripId) {
      // For existing trip, update the trip with the new document reference
      const trip = trips.value.find(t => t.id === tripId);
      if (trip) {
        const updatedNotes = trip.notes + `\n\nDOCUMENT:\n${fileName} (${fileKey})`;
        await client.models.Trip.update({
          id: tripId,
          notes: updatedNotes
        });
        
        // Refresh trip list
        listTrips();
        
        // Load the image URL
        loadTripImages(tripId);
      }
    } else {
      // For new trip, add to documents array
      newTrip.documents.push({
        name: fileName,
        key: fileKey,
        type: fileType
      });
    }
  } catch (error) {
    console.error('Error uploading file:', error);
    alert('Failed to upload file. Please try again.');
  } finally {
    uploadingFile.value = false;
    // Clear the input
    input.value = '';
  }
}

async function loadTripImages(tripId: string) {
  const trip = trips.value.find(t => t.id === tripId);
  if (!trip || !trip.notes) return;
  
  // Extract document keys from notes
  const docMatches = trip.notes.match(/DOCUMENT:[\s\S]*?|DOCUMENTS:[\s\S]*?(?=\n\n|$)/g);
  if (!docMatches) return;
  
  const documents: {name: string, key: string, url: string, type: string}[] = [];
  
  for (const docSection of docMatches) {
    const lines = docSection.split('\n').slice(1); // Skip the DOCUMENT(S): header
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      const match = line.match(/(.+) \((.+)\)/);
      if (match) {
        const [, name, key] = match;
        try {
          // Get the URL for the document
          const result = await getUrl({
            key: key.trim()
          });
          
          const fileType = key.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 
                          key.toLowerCase().match(/\.(jpg|jpeg|png|gif)$/) ? 'image' : 'other';
          
          documents.push({
            name: name.trim(),
            key: key.trim(),
            url: result.url.toString(),
            type: fileType
          });
        } catch (error) {
          console.error('Error getting URL for document:', error);
        }
      }
    }
  }
  
  // Update the tripImages state
  tripImages.value[tripId] = documents;
}

async function deleteDocument(tripId: string, docKey: string) {
  try {
    // Remove from S3
    await remove({ key: docKey });
    
    // Update trip notes to remove the document reference
    const trip = trips.value.find(t => t.id === tripId);
    if (trip && trip.notes) {
      const docName = tripImages.value[tripId]?.find(doc => doc.key === docKey)?.name || '';
      const updatedNotes = trip.notes.replace(`\n${docName} (${docKey})`, '');
      
      await client.models.Trip.update({
        id: tripId,
        notes: updatedNotes
      });
      
      // Refresh trip list and images
      listTrips();
      loadTripImages(tripId);
    }
  } catch (error) {
    console.error('Error deleting document:', error);
    alert('Failed to delete document. Please try again.');
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

function hasDocuments(notes: string): boolean {
  return notes.includes('DOCUMENT:') || notes.includes('DOCUMENTS:');
}

function hasNotes(notes: string): boolean {
  // Check if there's content before the FLIGHT:, HOTEL:, or DOCUMENTS: sections
  const firstSection = Math.min(
    notes.indexOf('FLIGHT:') >= 0 ? notes.indexOf('FLIGHT:') : Infinity,
    notes.indexOf('HOTEL:') >= 0 ? notes.indexOf('HOTEL:') : Infinity,
    notes.indexOf('DOCUMENT:') >= 0 ? notes.indexOf('DOCUMENT:') : Infinity,
    notes.indexOf('DOCUMENTS:') >= 0 ? notes.indexOf('DOCUMENTS:') : Infinity
  );
  
  return firstSection > 0 && notes.substring(0, firstSection).trim().length > 0;
}

function extractNotes(notes: string): string {
  const firstSection = Math.min(
    notes.indexOf('FLIGHT:') >= 0 ? notes.indexOf('FLIGHT:') : Infinity,
    notes.indexOf('HOTEL:') >= 0 ? notes.indexOf('HOTEL:') : Infinity,
    notes.indexOf('DOCUMENT:') >= 0 ? notes.indexOf('DOCUMENT:') : Infinity,
    notes.indexOf('DOCUMENTS:') >= 0 ? notes.indexOf('DOCUMENTS:') : Infinity
  );
  
  return firstSection < Infinity ? notes.substring(0, firstSection).trim() : notes;
}

function extractFlightDetails(notes: string): string {
  if (!hasFlightBooking(notes)) return '';
  
  const flightStart = notes.indexOf('FLIGHT:');
  const nextSection = Math.min(
    notes.indexOf('HOTEL:', flightStart) >= 0 ? notes.indexOf('HOTEL:', flightStart) : Infinity,
    notes.indexOf('DOCUMENT:', flightStart) >= 0 ? notes.indexOf('DOCUMENT:', flightStart) : Infinity,otes.indexOf('DOCUMENT:', flightStart) : Infinity,
    notes.indexOf('DOCUMENTS:', flightStart) >= 0 ? notes.indexOf('DOCUMENTS:', flightStart) : Infinity
  );
  
  if (nextSection < Infinity) {
    return notes.substring(flightStart + 7, nextSection).trim();
  } else {
    return notes.substring(flightStart + 7).trim();
  }
}otes.indexOf('DOCUMENT:', flightStart) : Infinity,
    notes.indexOf('DOCUMENTS:', flightStart) >= 0 ? notes.indexOf('DOCUMENTS:', flightStart) : Infinity
  );
  
  if (nextSection < Infinity) {
    return notes.substring(flightStart + 7, nextSection).trim();
  } else {
    return notes.substring(flightStart + 7).trim();
  }
}otes.indexOf('DOCUMENT:', flightStart) : Infinity,
    notes.indexOf('DOCUMENTS:', flightStart) >= 0 ? notes.indexOf('DOCUMENTS:', flightStart) : Infinity
  );
  
  if (nextSection < Infinity) {
    return notes.substring(flightStart + 7, nextSection).trim();
  } else {
    return notes.substring(flightStart + 7).trim();
  }
}

function extractHotelDetails(notes: string): string {
  if (!hasHotelBooking(notes)) return '';
  
  const hotelStart = notes.indexOf('HOTEL:');
  const nextSection = Math.min(
    notes.indexOf('DOCUMENT:', hotelStart) >= 0 ? notes.indexOf('DOCUMENT:', hotelStart) : Infinity,
    notes.indexOf('DOCUMENTS:', hotelStart) >= 0 ? notes.indexOf('DOCUMENTS:', hotelStart) : Infinity
  );
  
  if (nextSection < Infinity) {
    return notes.substring(hotelStart + 6, nextSection).trim();
  } else {
    return notes.substring(hotelStart + 6).trim();
  }
}

// Navigation functions for tabs
function navigateTabs() {
  if (activeTab.value === 'details') {
    activeTab.value = 'flight';
  } else if (activeTab.value === 'flight') {
    activeTab.value = 'hotel';
  } else if (activeTab.value === 'hotel') {
    activeTab.value = 'documents';
  } else {
    activeTab.value = 'details';
  }
}

function getNextButtonText() {
  switch (activeTab.value) {
    case 'details': return 'Next: Flight';
    case 'flight': return 'Next: Hotel';
    case 'hotel': return 'Next: Documents';
    case 'documents': return 'Back to Details';
    default: return 'Next';
  }
}

function openImage(url: string) {
  window.open(url, '_blank');
}

// Load trip images when trips are loaded
function loadAllTripImages() {
  trips.value.forEach(trip => {
    if (trip.id) {
      loadTripImages(trip.id);
    }
  });
}

// fetch trips when the component is mounted
onMounted(() => {
  listTrips();
  
  // Set up a watcher to load images when trips change
  watch(trips, () => {
    loadAllTripImages();
  });
});otes.indexOf('DOCUMENT:', flightStart) : Infinity,
    notes.indexOf('DOCUMENTS:', flightStart) >= 0 ? notes.indexOf('DOCUMENTS:', flightStart) : Infinity
  );
  
  if (nextSection < Infinity) {
    return notes.substring(flightStart + 7, nextSection).trim();
  } else {
    return notes.substring(flightStart + 7).trim();
  }
}

function extractHotelDetails(notes: string): string {
  if (!hasHotelBooking(notes)) return '';
  
  const hotelStart = notes.indexOf('HOTEL:');
  const nextSection = Math.min(
    notes.indexOf('DOCUMENT:', hotelStart) >= 0 ? notes.indexOf('DOCUMENT:', hotelStart) : Infinity,
    notes.indexOf('DOCUMENTS:', hotelStart) >= 0 ? notes.indexOf('DOCUMENTS:', hotelStart) : Infinity
  );
  
  if (nextSection < Infinity) {
    return notes.substring(hotelStart + 6, nextSection).trim();
  } else {
    return notes.substring(hotelStart + 6).trim();
  }
}

// Navigation functions for tabs
function navigateTabs() {
  if (activeTab.value === 'details') {
    activeTab.value = 'flight';
  } else if (activeTab.value === 'flight') {
    activeTab.value = 'hotel';
  } else if (activeTab.value === 'hotel') {
    activeTab.value = 'documents';
  } else {
    activeTab.value = 'details';
  }
}

function getNextButtonText() {
  switch (activeTab.value) {
    case 'details': return 'Next: Flight';
    case 'flight': return 'Next: Hotel';
    case 'hotel': return 'Next: Documents';
    case 'documents': return 'Back to Details';
    default: return 'Next';
  }
}

function openImage(url: string) {
  window.open(url, '_blank');
}
    
// Load trip images when trips are loaded
function loadAllTripImages() {
  trips.value.forEach(trip => {
    if (trip.id) {
      loadTripImages(trip.id);
    }
  });
}

// fetch trips when the component is mounted
onMounted(() => {
  listTrips();
  
  // Set up a watcher to load images when trips change
  watch(trips, () => {
    loadAllTripImages();
  });
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
        <button 
          @click="activeTab = 'documents'" 
          :class="['tab-btn', activeTab === 'documents' ? 'active' : '']">
          Documents
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
      
      <!-- Documents Tab -->
      <div v-if="activeTab === 'documents'" class="tab-content">
        <h3>Trip Documents</h3>
        <p class="document-info">Upload travel documents, passport scans, or destination photos.</p>
        
        <div class="document-upload">
          <label for="document-upload" class="upload-label">
            <span class="upload-icon">📁</span>
            <span>Choose File</span>
          </label>
          <input 
            type="file" 
            id="document-upload" 
            @change="handleFileUpload($event)" 
            accept="image/*,application/pdf"
            :disabled="uploadingFile" 
          />
          <span v-if="uploadingFile" class="upload-status">Uploading...</span>
        </div>
        
        <div v-if="newTrip.documents.length > 0" class="document-list">
          <h4>Uploaded Documents</h4>
          <ul>
            <li v-for="(doc, index) in newTrip.documents" :key="index" class="document-item">
              <span class="document-icon">{{ doc.type.includes('image') ? '🖼️' : '📄' }}</span>
              <span class="document-name">{{ doc.name }}</span>
            </li>
          </ul>
        </div>
      </div>
      
      <div class="form-actions">
        <button @click="createTrip" class="save-btn">Save Trip</button>
        <button @click="navigateTabs" class="next-btn">
          {{ getNextButtonText() }}
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
        
        <div class="trip-bookings" v-if="hasBookings(trip.notes || '') || hasDocuments(trip.notes || '')">
          <div class="booking-icons">
            <span v-if="hasFlightBooking(trip.notes || '')" class="booking-icon flight-icon" title="Flight booked">✈️</span>
            <span v-if="hasHotelBooking(trip.notes || '')" class="booking-icon hotel-icon" title="Hotel booked">🏨</span>
            <span v-if="hasDocuments(trip.notes || '')" class="booking-icon document-icon" title="Documents attached">📁</span>
          </div>
        </div>
        
        <div class="trip-notes" v-if="trip.notes">
          <div v-if="!hasBookings(trip.notes) && !hasDocuments(trip.notes)" class="notes-content">{{ trip.notes }}</div>
          <div v-else class="booking-details">
            <div v-if="hasFlightBooking(trip.notes)" class="flight-details">
              <h4>Flight Details</h4>
              <pre>{{ extractFlightDetails(trip.notes) }}</pre>
            </div>
            <div v-if="hasHotelBooking(trip.notes)" class="hotel-details">
              <h4>Hotel Details</h4>
              <pre>{{ extractHotelDetails(trip.notes) }}</pre>
            </div>
            <div v-if="hasDocuments(trip.notes) && tripImages[trip.id]?.length > 0" class="document-gallery">
              <h4>Documents</h4>
              <div class="document-grid">
                <div v-for="(doc, index) in tripImages[trip.id]" :key="index" class="document-thumbnail">
                  <div v-if="doc.type.includes('image')" class="image-preview">
                    <img :src="doc.url" :alt="doc.name" @click="openImage(doc.url)" />
                  </div>
                  <div v-else class="file-preview" @click="window.open(doc.url, '_blank')">
                    <span class="file-icon">📄</span>
                    <span class="file-name">{{ doc.name }}</span>
                  </div>
                  <button class="delete-document" @click="deleteDocument(trip.id, doc.key)" title="Delete document">×</button>
                </div>
                
                <div class="add-document">
                  <label :for="'document-upload-' + trip.id" class="upload-button">
                    <span class="upload-icon">+</span>
                  </label>
                  <input 
                    :id="'document-upload-' + trip.id" 
                    type="file" 
                    @change="handleFileUpload($event, trip.id)" 
                    accept="image/*,application/pdf"
                    :disabled="uploadingFile" 
                  />
                </div>
              </div>
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
  flex-wrap: wrap;
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

/* Document upload styles */
.document-upload {
  display: flex;
  align-items: center;
  margin: 20px 0;
}

.upload-label {
  display: flex;
  align-items: center;
  padding: 10px 15px;
  background-color: #42b983;
  color: white;
  border-radius: 4px;
  cursor: pointer;
}

.upload-icon {
  margin-right: 8px;
  font-size: 18px;
}

input[type="file"] {
  display: none;
}

.upload-status {
  margin-left: 10px;
  color: #666;
  font-style: italic;
}

.document-info {
  color: #666;
  margin-bottom: 15px;
}

.document-list {
  margin-top: 20px;
  background-color: #f5f5f5;
  border-radius: 4px;
  padding: 10px;
}

.document-item {
  display: flex;
  align-items: center;
  padding: 5px 0;
}

.document-icon {
  margin-right: 10px;
  font-size: 18px;
}

.document-name {
  font-size: 14px;
  color: #333;
}

/* Document gallery styles */
.document-gallery {
  margin-top: 15px;
}

.document-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 10px;
  margin-top: 10px;
}

.document-thumbnail {
  position: relative;
  height: 100px;
  border: 1px solid #ddd;
  border-radius: 4px;
  overflow: hidden;
}

.image-preview {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.image-preview img {
  max-width: 100%;
  max-height: 100%;
  object-fit: cover;
}

.file-preview {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 5px;
}

.file-icon {
  font-size: 24px;
  margin-bottom: 5px;
}

.file-name {
  font-size: 10px;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 100%;
}

.delete-document {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background-color: rgba(255, 255, 255, 0.7);
  border: none;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.add-document {
  height: 100px;
  border: 1px dashed #ddd;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.upload-button {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: #f5f5f5;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.upload-button .upload-icon {
  font-size: 24px;
  color: #666;
}
</style>
