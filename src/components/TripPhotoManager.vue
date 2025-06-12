<template>
  <div class="trip-photo-manager">
    <h2>Trip Photo Manager</h2>
    
    <div class="trip-selector" v-if="trips.length > 0">
      <label for="trip-select">Select Trip:</label>
      <select id="trip-select" v-model="selectedTripId" @change="handleTripChange">
        <option value="">-- Select a Trip --</option>
        <option v-for="trip in trips" :key="trip.id" :value="trip.id">
          {{ trip.destination }} ({{ trip.startDate }})
        </option>
      </select>
    </div>
    
    <div v-if="selectedTripId" class="upload-section">
      <input type="file" @change="handleFileChange" />
      <button @click="handleUpload" :disabled="!file">Upload Photo</button>
      <div v-if="uploadStatus" class="status-message">{{ uploadStatus }}</div>
    </div>
    
    <div v-if="selectedTrip && selectedTrip.photoKeys" class="photos-list">
      <h3>Trip Photos</h3>
      <ul>
        <li v-for="photoKey in photoKeysList" :key="photoKey">
          {{ photoKey.split('/').pop() }}
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { uploadData } from 'aws-amplify/storage';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';

interface Trip {
  id: string;
  destination: string;
  startDate: string;
  endDate: string;
  budget: number;
  notes: string;
  status: string;
  photoKeys?: string;
}

const client = generateClient<Schema>();
const trips = ref<Trip[]>([]);
const selectedTripId = ref('');
const file = ref<File | null>(null);
const uploadStatus = ref('');

const selectedTrip = computed(() => {
  return trips.value.find(trip => trip.id === selectedTripId.value);
});

const photoKeysList = computed(() => {
  if (!selectedTrip.value || !selectedTrip.value.photoKeys) {
    return [];
  }
  return selectedTrip.value.photoKeys.split(',').filter((key: string) => key.trim() !== '');
});

onMounted(async () => {
  await fetchTrips();
});

const fetchTrips = async () => {
  try {
    const response = await client.models.Trip.list();
    trips.value = response.data;
  } catch (error) {
    console.error('Error fetching trips:', error);
  }
};

const handleTripChange = () => {
  uploadStatus.value = '';
  file.value = null;
};

const handleFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    file.value = target.files[0];
  }
};

const handleUpload = async () => {
  if (!file.value || !selectedTripId.value) return;
  
  try {
    uploadStatus.value = 'Uploading...';
    const fileKey = `trip-photos/${selectedTripId.value}/${file.value.name}`;
    
    // Upload to S3
    await uploadData({
      path: fileKey,
      data: file.value
    });
    
    // Update the Trip record in DynamoDB
    const currentTrip = selectedTrip.value;
    if (!currentTrip) return;
    
    const currentKeys = currentTrip.photoKeys || '';
    const newPhotoKeys = currentKeys ? `${currentKeys},${fileKey}` : fileKey;
    
    await client.models.Trip.update({
      id: selectedTripId.value,
      photoKeys: newPhotoKeys
    });
    
    // Refresh trips data
    await fetchTrips();
    
    uploadStatus.value = 'Upload successful!';
    file.value = null;
    
  } catch (error) {
    console.error('Error uploading file:', error);
    uploadStatus.value = 'Upload failed. Please try again.';
  }
};
</script>

<style scoped>
.trip-photo-manager {
  margin: 20px 0;
  padding: 20px;
  border: 1px solid #eee;
  border-radius: 8px;
}

.trip-selector {
  margin-bottom: 20px;
}

.trip-selector select {
  margin-left: 10px;
  padding: 5px;
}

.upload-section {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  align-items: center;
}

button {
  padding: 8px 16px;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.status-message {
  margin-left: 10px;
  font-style: italic;
}

.photos-list ul {
  padding-left: 20px;
}
</style>