<script setup lang="ts">
import '@/assets/main.css';
import { onMounted, ref } from 'vue';
import type { Schema } from '../../amplify/data/resource';
import { generateClient } from 'aws-amplify/data';

const client = generateClient<Schema>();

const todos = ref<Array<Schema['Todo']['type']>>([]);

const formData = ref({
  content: '',
  destination: '',
  date: '',
  passengers: 1,
  contactEmail: '',
  status: 'PENDING'
});

function listTodos() {
  client.models.Todo.observeQuery().subscribe({
    next: ({ items, isSynced }: { items: Schema['Todo']['type'][], isSynced: boolean }) => {
      todos.value = items;
    },
  }); 
}

function createTodo() {
  if (!formData.value.destination || !formData.value.date || !formData.value.contactEmail) {
    alert('Please fill in all required fields');
    return;
  }

  const newTodo = {
    content: formData.value.destination,
    destination: formData.value.destination,
    date: formData.value.date,
    passengers: formData.value.passengers,
    contactEmail: formData.value.contactEmail,
    status: formData.value.status
  };

  client.models.Todo.create(newTodo).then(() => {
    formData.value = {
      content: '',
      destination: '',
      date: '',
      passengers: 1,
      contactEmail: '',
      status: 'PENDING'
    };
    listTodos();
    alert('Booking submitted successfully!');
  }).catch((error: Error) => {
    alert('Error creating booking: ' + error.message);
  });
}

onMounted(() => {
  listTodos();
});
</script>

<template>
  <main>
    <h1>Trip Booking System</h1>
    
    <!-- Booking Form -->
    <div class="booking-form">
      <h2>Create New Booking</h2>
      <form @submit.prevent="createTodo">
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
      <table v-if="todos.length">
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
          <tr v-for="todo in todos" :key="todo.id">
            <td>{{ todo.destination }}</td>
            <td>{{ new Date(todo.date).toLocaleDateString() }}</td>
            <td>{{ todo.passengers }}</td>
            <td>{{ todo.contactEmail }}</td>
            <td>{{ todo.status }}</td>
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