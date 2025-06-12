<template>
  <div class="file-upload">
    <h2>Trip Photo Upload</h2>
    <div class="upload-container">
      <input type="file" @change="handleFileChange" />
      <button @click="handleUpload" :disabled="!file">Upload</button>
    </div>
    <div v-if="uploadStatus" class="status-message">{{ uploadStatus }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { uploadData } from 'aws-amplify/storage';

const file = ref<File | null>(null);
const uploadStatus = ref('');

const handleFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    file.value = target.files[0];
  }
};

const handleUpload = async () => {
  if (!file.value) return;
  
  try {
    uploadStatus.value = 'Uploading...';
    const fileKey = `trip-photos/${file.value.name}`;
    
    await uploadData({
      path: fileKey,
      data: file.value
    });
    
    uploadStatus.value = 'Upload successful!';
    file.value = null;
    
  } catch (error) {
    console.error('Error uploading file:', error);
    uploadStatus.value = 'Upload failed. Please try again.';
  }
};
</script>

<style scoped>
.file-upload {
  margin: 20px 0;
  padding: 20px;
  border: 1px solid #eee;
  border-radius: 8px;
}

.upload-container {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
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
  margin-top: 10px;
  font-style: italic;
}
</style>