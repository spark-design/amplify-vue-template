<script setup lang="ts">
import '@/assets/main.css';
import { onMounted, ref } from 'vue';
import type { Schema } from '../../amplify/data/resource';
import { generateClient } from 'aws-amplify/data';

const client = generateClient<Schema>();

// create a reactive reference to the array of bookings
const bookings = ref<Array<Schema['Booking']["type"]>>([]);

// Add form data reactive references
const formData = ref({
  destination: '',
  date: '',
  passengers: 1,
  contactEmail: ''
});

function listBookings() {
  client.models.Booking.observeQuery().subscribe({
    next: ({ items, isSynced }) => {
      bookings.value = items
     },
  }); 
}

function createBooking() {
  if (!formData.value.destination || !formData.value.date || !formData.value.contactEmail) {
    alert('Please fill in all required fields');
    return;
  }

  client.models.Booking.create({
    destination: formData.value.destination,
    date: formData.value.date,
    passengers: formData.value.passengers,
    contactEmail: formData.value.contactEmail,
    status: 'PENDING' // You might want to add a status field to track booking state
  }).then(() => {
    // Reset form after successful booking
    formData.value = {
      destination: '',
      date: '',
      passengers: 1,
      contactEmail: ''
    };
    // Update the list of bookings
    listBookings();
    alert('Booking submitted successfully!');
  }).catch(error => {
    alert('Error creating booking: ' + error.message);
  });
}
    
// fetch bookings when the component is mounted
onMounted(() => {
  listBookings();
});

</script>

<template>
  <main>
    <h1>Trip Booking System</h1>
    
    <!-- Booking Form -->
    <div class="booking-form">
      <h2>Create New Booking</h2>
      <form @submit.prevent="createBooking">
        <div class="form-group">
          <label>Destination:</label>
          <input 
            type="text" 
            v-model="formData.destination" 
            required 
            placeholder="Enter destination"
          >
        </div>

        <div class="form-group">
          <label>Travel Date:</label>
          <input 
            type="date" 
            v-model="formData.date" 
            required
          >
        </div>

        <div class="form-group">
          <label>Number of Passengers:</label>
          <input 
            type="number" 
            v-model="formData.passengers" 
            min="1" 
            required
          >
        </div>

        <div class="form-group">
          <label>Contact Email:</label>
          <input 
            type="email" 
            v-model="formData.contactEmail" 
            required 
            placeholder="Enter your email"
          >
        </div>

        <button type="submit">Submit Booking</button>
      </form>
    </div>

    <!-- Bookings List -->
    <div class="bookings-list">
      <h2>Current Bookings</h2>
      <table v-if="bookings.length">
        <thead>
          <tr>
            <th>Destination</th>
            <th>Date</th>
            <th>Passengers</th>
            <th>Contact</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="booking in bookings" :key="booking.id">
            <td>{{ booking.destination }}</td>
            <td>{{ new Date(booking.date).toLocaleDateString() }}</td>
            <td>{{ booking.passengers }}</td>
            <td>{{ booking.contactEmail }}</td>
            <td>{{ booking.status }}</td>
          </tr>
        </tbody>
      </table>
      <p v-else>No bookings found</p>
    </div>
  </main>
</template>

<style scoped>
.booking-form {
  max-width: 500px;
  margin: 20px auto;
  padding: 20px;
  border: 1px solid #ccc;
  border-radius: 8px;
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
}

.form-group input {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

button {
  background-color: #4CAF50;
  color: white;
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

button:hover {
  background-color: #45a049;
}

.bookings-list {
  margin-top: 30px;
}

table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 10px;
}

th, td {
  border: 1px solid #ddd;
  padding: 8px;
  text-align: left;
}

th {
  background-color: #f2f2f2;
}
</style>
