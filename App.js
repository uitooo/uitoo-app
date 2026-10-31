import React, { useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  Image, 
  ScrollView, 
  ActivityIndicator, 
  Alert 
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { createClient } from '@supabase/supabase-js';

// Reemplaza estas dos constantes con tus credenciales de Supabase
const SUPABASE_URL = 'https://gbpzytsjizrtvsntjtjt.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_EX8L6YF7xm155rN0-SX6mA_-EhYNCYQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default function App() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [imageUri, setImageUri] = useState(null);
  const [loading, setLoading] = useState(false);

  // Función para seleccionar foto de perfil desde la galería
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  };

  // Función para registrar usuario
  const handleSignUp = async () => {
    if (!email || !password || !username) {
      Alert.alert('Error', 'Por favor completa todos los campos');
      return;
    }

    setLoading(true);
    try {
      // 1. Registro en Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) throw authError;

      let photoUrl = null;

      // 2. Subida de foto al bucket uitoo-media (si seleccionó foto)
      if (imageUri && authData.user) {
        const response = await fetch(imageUri);
        const blob = await response.blob();
        const fileName = `${authData.user.id}/${Date.now()}.jpg`;

        const { error: uploadError } = await supabase.storage
          .from('uitoo-media')
          .upload(fileName, blob);

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from('uitoo-media')
            .getPublicUrl(fileName);
          photoUrl = urlData.publicUrl;
        }
      }

      // 3. Crear registro en la tabla profiles
      if (authData.user) {
        const { error: profileError } = await supabase.from('profiles').insert([
          {
            id: authData.user.id,
            username: username,
            avatar_url: photoUrl,
          },
        ]);

        if (profileError) throw profileError;
      }

      Alert.alert('¡Bienvenido a UITOO!', 'Tu cuenta ha sido creada exitosamente.');
    } catch (error) {
      Alert.alert('Error en el registro', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>UITOO</Text>
      <Text style={styles.subtitle}>Evolución Cósmica</Text>

      {/* Selector de Foto de Perfil */}
      <TouchableOpacity onPress={pickImage} style={styles.imagePicker}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>+ Foto de Perfil</Text>
          </View>
        )}
      </TouchableOpacity>

      <TextInput
        style={styles.input}
        placeholder="Nombre de usuario"
        placeholderTextColor="#94A3B8"
        value={username}
        onChangeText={setUsername}
      />

      <TextInput
        style={styles.input}
        placeholder="Correo electrónico"
        placeholderTextColor="#94A3B8"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <TextInput
        style={styles.input}
        placeholder="Contraseña"
        placeholderTextColor="#94A3B8"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity 
        style={styles.button} 
        onPress={handleSignUp} 
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.buttonText}>CREAR CUENTA</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#0F172A', // Deep Indigo
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#8B5CF6', // Neon Violet
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#94A3B8',
    marginBottom: 32,
  },
  imagePicker: {
    marginBottom: 24,
  },
  avatarPlaceholder: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#1E293B',
    borderWidth: 2,
    borderColor: '#8B5CF6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#8B5CF6',
    fontSize: 13,
    fontWeight: '600',
  },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
  },
  input: {
    width: '100%',
    backgroundColor: '#1E293B',
    color: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  button: {
    width: '100%',
    backgroundColor: '#8B5CF6',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
});