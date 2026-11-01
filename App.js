import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  Image, 
  ScrollView, 
  ActivityIndicator, 
  Alert,
  FlatList,
  Modal,
  SafeAreaView
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gbpzytsjizrtvsntjtjt.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_EX8L6YF7xm155rN0-SX6mA_-EhYNCYQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default function App() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [imageUri, setImageUri] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(false);

  // Estados del Dashboard y Pestañas
  const [currentTab, setCurrentTab] = useState('feed'); // 'feed', 'academy', 'plus', 'profile', 'admin'
  const [posts, setPosts] = useState([]);
  const [newPostContent, setNewPostContent] = useState('');
  const [postImageUri, setPostImageUri] = useState(null);
  const [isPostingModal, setIsPostingModal] = useState(false);
  
  // Estado de administración y perfil
  const [totalUsersCount, setTotalUsersCount] = useState(0);
  const [adminTitle, setAdminTitle] = useState('');
  const [adminUrl, setAdminUrl] = useState('');
  const [newUsername, setNewUsername] = useState('');

  // Estados de interacciones
  const [interactions, setInteractions] = useState({});

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchAppData();
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchAppData();
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchAppData = async () => {
    try {
      const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select('*, profiles(username, avatar_url)')
        .order('created_at', { ascending: false });

      if (!postsError && postsData) setPosts(postsData);

      const { count, error: countError } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      if (!countError) setTotalUsersCount(count || 0);
    } catch (e) {
      console.log('Error cargando datos:', e.message);
    }
  };

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

  const pickPostImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      setPostImageUri(result.assets[0].uri);
    }
  };

  const handleAuthAction = async () => {
    if (!email || !password || (!isLogin && !username)) {
      Alert.alert('Error', 'Por favor completa todos los campos requeridos');
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
        if (authError) throw authError;

        let photoUrl = null;
        if (imageUri && authData.user) {
          const response = await fetch(imageUri);
          const blob = await response.blob();
          const fileName = `${authData.user.id}/${Date.now()}.jpg`;

          const { error: uploadError } = await supabase.storage
            .from('uitoo-media')
            .upload(fileName, blob);

          if (!uploadError) {
            const { data: urlData } = supabase.storage.from('uitoo-media').getPublicUrl(fileName);
            photoUrl = urlData.publicUrl;
          }
        }

        if (authData.user) {
          const { error: profileError } = await supabase.from('profiles').insert([
            { id: authData.user.id, username: username, avatar_url: photoUrl }
          ]);
          if (profileError) throw profileError;
        }
        Alert.alert('¡Bienvenido a UITOO!', 'Tu cuenta ha sido creada exitosamente.');
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePost = async () => {
    if (!newPostContent.trim() && !postImageUri) {
      Alert.alert('Aviso', 'Escribe algo o agrega una foto para tu avance.');
      return;
    }

    try {
      let postMediaUrl = null;

      if (postImageUri && session.user) {
        const response = await fetch(postImageUri);
        const blob = await response.blob();
        const fileName = `${session.user.id}/post_${Date.now()}.jpg`;

        const { error: uploadError } = await supabase.storage
          .from('uitoo-media')
          .upload(fileName, blob);

        if (uploadError) {
          throw new Error('Error al subir la imagen al storage: ' + uploadError.message);
        }

        const { data: urlData } = supabase.storage
          .from('uitoo-media')
          .getPublicUrl(fileName);
          
        postMediaUrl = urlData.publicUrl;
      }

      const { error } = await supabase.from('posts').insert([
        { 
          user_id: session.user.id, 
          content: newPostContent,
          media_url: postMediaUrl 
        }
      ]);

      if (error) throw error;

      setNewPostContent('');
      setPostImageUri(null);
      setIsPostingModal(false);
      fetchAppData();
      Alert.alert('¡Éxito!', 'Tu avance ha sido publicado.');
    } catch (error) {
      Alert.alert('Error al publicar', error.message);
    }
  };

  const handleInteraction = (postId, type) => {
    setInteractions(prev => {
      const current = prev[postId] || { sameProcess: 0, support: 0, join: 0 };
      const updatedCount = current[type] + 1;
      
      let message = '';
      if (type === 'sameProcess') message = '¡Genial! Indicaste que también trabajas en este proceso.';
      if (type === 'support') message = '¡Apoyo enviado! 💪';
      if (type === 'join') message = '¡Solicitud enviada para vincularte a este proyecto! ✋';

      Alert.alert('Interacción de UITOO', message);

      return {
        ...prev,
        [postId]: { ...current, [type]: updatedCount }
      };
    });
  };

  const handleUpdateProfile = async () => {
    if (!newUsername.trim()) return;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ username: newUsername })
        .eq('id', session.user.id);

      if (error) throw error;
      Alert.alert('Actualizado', 'Tu nombre de usuario ha sido modificado.');
      setNewUsername('');
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  const handleAdminUpload = async () => {
    if (!adminTitle || !adminUrl) {
      Alert.alert('Error', 'Completa el título y la URL del contenido.');
      return;
    }

    try {
      const { error } = await supabase.from('content_items').insert([
        { title: adminTitle, url: adminUrl, category: 'academy' }
      ]);

      if (error) throw error;
      Alert.alert('Administración', 'Contenido subido exitosamente.');
      setAdminTitle('');
      setAdminUrl('');
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  // --- INTERFAZ PRINCIPAL CON PESTAÑAS Y NAVEGACIÓN ---
  if (session && session.user) {
    return (
      <SafeAreaView style={styles.dashboardContainer}>
        {/* Cabecera */}
        <View style={styles.headerBar}>
          <Text style={styles.dashboardTitle}>UITOO</Text>
          <TouchableOpacity onPress={() => supabase.auth.signOut()}>
            <Text style={styles.logoutText}>Salir</Text>
          </TouchableOpacity>
        </View>

        {/* CONTENIDO SEGÚN LA PESTAÑA ACTIVA */}
        <View style={styles.contentArea}>
          {currentTab === 'feed' && (
            <View style={{ flex: 1, width: '100%' }}>
              <View style={styles.feedHeader}>
                <Text style={styles.sectionTitle}>Avances Personales</Text>
                <TouchableOpacity 
                  style={styles.smallButton} 
                  onPress={() => setIsPostingModal(true)}
                >
                  <Text style={styles.smallButtonText}>+ Publicar Avance</Text>
                </TouchableOpacity>
              </View>

              <FlatList
                data={posts}
                keyExtractor={(item) => item.id ? item.id.toString() : Math.random().toString()}
                renderItem={({ item }) => {
                  const itemInteractions = interactions[item.id] || { sameProcess: 0, support: 0, join: 0 };
                  return (
                    <View style={styles.postCard}>
                      <View style={styles.postHeader}>
                        <Text style={styles.postUser}>@{item.profiles?.username || 'Usuario'}</Text>
                      </View>
                      <Text style={styles.postContent}>{item.content}</Text>
                      
                      {item.media_url ? (
                        <Image source={{ uri: item.media_url }} style={styles.postImage} />
                      ) : null}

                      {/* Botones de interacción debajo del post */}
                      <View style={styles.interactionBar}>
                        <TouchableOpacity 
                          style={styles.actionBtn}
                          onPress={() => handleInteraction(item.id, 'sameProcess')}
                        >
                          <Text style={styles.actionIcon}>🔄</Text>
                          <Text style={styles.actionLabel}>También ({itemInteractions.sameProcess})</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                          style={styles.actionBtn}
                          onPress={() => handleInteraction(item.id, 'support')}
                        >
                          <Text style={styles.actionIcon}>💪</Text>
                          <Text style={styles.actionLabel}>Apoyo ({itemInteractions.support})</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                          style={styles.actionBtn}
                          onPress={() => handleInteraction(item.id, 'join')}
                        >
                          <Text style={styles.actionIcon}>✋</Text>
                          <Text style={styles.actionLabel}>Vincular ({itemInteractions.join})</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                }}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>No hay publicaciones aún. ¡Sé el primero en compartir tu avance!</Text>
                }
              />
            </View>
          )}

          {currentTab === 'academy' && (
            <ScrollView contentContainerStyle={styles.tabContent}>
              <Text style={styles.sectionTitle}>📚 Academia de Crecimiento</Text>
              <Text style={styles.tabSubtitle}>Libros, guías y videos recomendados para potenciar tu mentalidad.</Text>
              <View style={styles.cardBox}>
                <Text style={styles.cardTitle}>Éxito Cuántico y Enfoque</Text>
                <Text style={styles.cardDesc}>Aprende las claves fundamentales para alinear tus metas con tus acciones diarias.</Text>
              </View>
            </ScrollView>
          )}

          {currentTab === 'plus' && (
            <ScrollView contentContainerStyle={styles.tabContent}>
              <Text style={styles.sectionTitle}>⭐ UITOO Plus</Text>
              <Text style={styles.tabSubtitle}>Contenido exclusivo con psicólogos y expertos internacionales.</Text>
              <View style={styles.cardBoxPlus}>
                <Text style={styles.cardTitle}>Masterclass: El poder de la Subconciencia</Text>
                <Text style={styles.cardDesc}>Sesión avanzada guiada por especialistas en salud mental.</Text>
              </View>
            </ScrollView>
          )}

          {currentTab === 'profile' && (
            <ScrollView contentContainerStyle={styles.tabContent}>
              <Text style={styles.sectionTitle}>⚙️ Configuración de Perfil</Text>
              <Text style={styles.labelInput}>Cambiar Nombre de Usuario:</Text>
              <TextInput
                style={styles.input}
                placeholder="Nuevo nombre de usuario"
                placeholderTextColor="#94A3B8"
                value={newUsername}
                onChangeText={setNewUsername}
              />
              <TouchableOpacity style={styles.mainButton} onPress={handleUpdateProfile}>
                <Text style={styles.buttonText}>Actualizar Nombre</Text>
              </TouchableOpacity>
            </ScrollView>
          )}

          {currentTab === 'admin' && (
            <ScrollView contentContainerStyle={styles.tabContent}>
              <Text style={styles.sectionTitle}>🛡️ Panel de Administrador</Text>
              <View style={styles.statsCard}>
                <Text style={styles.statsNumber}>{totalUsersCount}</Text>
                <Text style={styles.statsLabel}>Usuarios totales en UITOO</Text>
              </View>

              <Text style={styles.sectionTitleSmall}>Subir Nuevo Contenido</Text>
              <TextInput
                style={styles.input}
                placeholder="Título del contenido"
                placeholderTextColor="#94A3B8"
                value={adminTitle}
                onChangeText={setAdminTitle}
              />
              <TextInput
                style={styles.input}
                placeholder="Enlace URL (Video / PDF)"
                placeholderTextColor="#94A3B8"
                value={adminUrl}
                onChangeText={setAdminUrl}
              />
              <TouchableOpacity style={styles.mainButton} onPress={handleAdminUpload}>
                <Text style={styles.buttonText}>Publicar Contenido</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>

        {/* BARRA DE NAVEGACIÓN INFERIOR FIJA */}
        <View style={styles.navBar}>
          <TouchableOpacity onPress={() => setCurrentTab('feed')} style={styles.navItem}>
            <Text style={[styles.navText, currentTab === 'feed' && styles.navActive]}>Feed</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setCurrentTab('academy')} style={styles.navItem}>
            <Text style={[styles.navText, currentTab === 'academy' && styles.navActive]}>Academia</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setCurrentTab('plus')} style={styles.navItem}>
            <Text style={[styles.navText, currentTab === 'plus' && styles.navActive]}>Plus</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setCurrentTab('profile')} style={styles.navItem}>
            <Text style={[styles.navText, currentTab === 'profile' && styles.navActive]}>Perfil</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setCurrentTab('admin')} style={styles.navItem}>
            <Text style={[styles.navText, currentTab === 'admin' && styles.navActive]}>Admin</Text>
          </TouchableOpacity>
        </View>

        {/* MODAL PARA CREAR PUBLICACIÓN CON FOTO */}
        <Modal visible={isPostingModal} animationType="slide" transparent={true}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.sectionTitle}>Comparte tu avance</Text>
              
              <TextInput
                style={styles.textArea}
                placeholder="¿En qué estás trabajando hoy para tu crecimiento personal?"
                placeholderTextColor="#94A3B8"
                multiline
                value={newPostContent}
                onChangeText={setNewPostContent}
              />

              <TouchableOpacity style={styles.attachButton} onPress={pickPostImage}>
                <Text style={styles.attachButtonText}>
                  {postImageUri ? '📷 Imagen adjuntada (Cambiar)' : '📷 Adjuntar Foto al Avance'}
                </Text>
              </TouchableOpacity>

              {postImageUri ? (
                <Image source={{ uri: postImageUri }} style={styles.previewImage} />
              ) : null}

              <TouchableOpacity style={styles.mainButton} onPress={handleCreatePost}>
                <Text style={styles.buttonText}>Publicar</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.mainButton, { backgroundColor: '#334155', marginTop: 10 }]} 
                onPress={() => {
                  setPostImageUri(null);
                  setIsPostingModal(false);
                }}
              >
                <Text style={styles.buttonText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  // --- PANTALLA DE LOGIN / REGISTRO ---
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>UITOO</Text>
      <Text style={styles.subtitle}>{isLogin ? 'Iniciar Sesión' : 'Evolución Cósmica'}</Text>

      {!isLogin && (
        <TouchableOpacity onPress={pickImage} style={styles.imagePicker}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>+ Foto de Perfil</Text>
            </View>
          )}
        </TouchableOpacity>
      )}

      {!isLogin && (
        <TextInput
          style={styles.input}
          placeholder="Nombre de usuario"
          placeholderTextColor="#94A3B8"
          value={username}
          onChangeText={setUsername}
        />
      )}

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

      <TouchableOpacity style={styles.mainButton} onPress={handleAuthAction} disabled={loading}>
        {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>{isLogin ? 'INICIAR SESIÓN' : 'CREAR CUENTA'}</Text>}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setIsLogin(!isLogin)} style={styles.switchButton}>
        <Text style={styles.switchText}>
          {isLogin ? "¿No tienes cuenta? Regístrate aquí" : "¿Ya tienes cuenta? Inicia sesión aquí"}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center', padding: 24 },
  dashboardContainer: { flex: 1, backgroundColor: '#0F172A' },
  headerBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
  dashboardTitle: { fontSize: 24, fontWeight: 'bold', color: '#8B5CF6' },
  logoutText: { color: '#EF4444', fontWeight: 'bold', fontSize: 14 },
  contentArea: { flex: 1, padding: 16 },
  feedHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 12 },
  sectionTitleSmall: { fontSize: 16, fontWeight: 'bold', color: '#FFFFFF', marginTop: 16, marginBottom: 8 },
  labelInput: { color: '#94A3B8', marginBottom: 8 },
  tabSubtitle: { color: '#94A3B8', marginBottom: 16 },
  tabContent: { paddingBottom: 40 },
  postCard: { backgroundColor: '#1E293B', padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#334155' },
  postHeader: { marginBottom: 8 },
  postUser: { color: '#8B5CF6', fontWeight: 'bold', fontSize: 14 },
  postContent: { color: '#F8FAFC', fontSize: 15, marginBottom: 12 },
  postImage: { width: '100%', height: 200, borderRadius: 8, marginBottom: 12 },
  interactionBar: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#334155', paddingTop: 10 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0F172A', paddingHorizontal: 6, paddingVertical: 6, borderRadius: 8 },
  actionIcon: { fontSize: 13, marginRight: 2 },
  actionLabel: { color: '#94A3B8', fontSize: 10, fontWeight: '600' },
  emptyText: { color: '#94A3B8', textAlign: 'center', marginTop: 40 },
  cardBox: { backgroundColor: '#1E293B', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#334155' },
  cardBoxPlus: { backgroundColor: '#1E293B', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#8B5CF6' },
  cardTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold', marginBottom: 6 },
  cardDesc: { color: '#94A3B8', fontSize: 14 },
  statsCard: { backgroundColor: '#1E293B', padding: 20, borderRadius: 12, alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: '#8B5CF6' },
  statsNumber: { fontSize: 36, fontWeight: 'bold', color: '#8B5CF6' },
  statsLabel: { color: '#94A3B8', fontSize: 14 },
  navBar: { flexDirection: 'row', backgroundColor: '#1E293B', borderTopWidth: 1, borderTopColor: '#334155', paddingVertical: 12, justifyContent: 'space-around' },
  navItem: { alignItems: 'center' },
  navText: { color: '#94A3B8', fontSize: 12, fontWeight: '600' },
  navActive: { color: '#8B5CF6' },
  smallButton: { backgroundColor: '#8B5CF6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  smallButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: 'bold' },
  title: { fontSize: 36, fontWeight: 'bold', color: '#8B5CF6', marginBottom: 4 },
  subtitle: { fontSize: 16, color: '#94A3B8', marginBottom: 32 },
  imagePicker: { marginBottom: 24 },
  avatarPlaceholder: { width: 110, height: 110, borderRadius: 55, backgroundColor: '#1E293B', borderWidth: 2, borderColor: '#8B5CF6', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#8B5CF6', fontSize: 13, fontWeight: '600' },
  avatar: { width: 110, height: 110, borderRadius: 55 },
  input: { width: '100%', backgroundColor: '#1E293B', color: '#FFFFFF', padding: 16, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: '#334155' },
  textArea: { width: '100%', height: 100, backgroundColor: '#1E293B', color: '#FFFFFF', padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#334155', textAlignVertical: 'top' },
  attachButton: { backgroundColor: '#1E293B', padding: 12, borderRadius: 8, alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: '#8B5CF6' },
  attachButtonText: { color: '#8B5CF6', fontWeight: '600', fontSize: 13 },
  previewImage: { width: '100%', height: 120, borderRadius: 8, marginBottom: 12 },
  mainButton: { width: '100%', backgroundColor: '#8B5CF6', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 },
  switchButton: { marginTop: 20, padding: 8 },
  switchText: { color: '#8B5CF6', fontSize: 14, textAlign: 'center', fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 },
  modalContent: { backgroundColor: '#0F172A', padding: 24, borderRadius: 16, borderWidth: 1, borderColor: '#334155' }
});