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

// Función auxiliar para fecha relativa
function formatFecha(fechaString) {
  if (!fechaString) return '';
  const fecha = new Date(fechaString);
  const ahora = new Date();
  const diferenciaMinutos = Math.floor((ahora - fecha) / (1000 * 60));

  if (diferenciaMinutos < 1) return 'Ahora mismo';
  if (diferenciaMinutos < 60) return `Hace ${diferenciaMinutos} min`;
  
  const horas = Math.floor(diferenciaMinutos / 60);
  if (horas < 24) return `Hace ${horas} h`;
  
  return fecha.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

export default function App() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [imageUri, setImageUri] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(false);

  // Estados del Dashboard y Pestañas
  const [currentTab, setCurrentTab] = useState('feed'); // 'feed', 'academy', 'plus', 'profile', 'admin', 'userProfile'
  const [posts, setPosts] = useState([]);
  const [newPostContent, setNewPostContent] = useState('');
  const [postImageUri, setPostImageUri] = useState(null);
  const [isPostingModal, setIsPostingModal] = useState(false);
  
  // Estado de administración y perfil
  const [totalUsersCount, setTotalUsersCount] = useState(0);
  const [adminTitle, setAdminTitle] = useState('');
  const [adminUrl, setAdminUrl] = useState('');
  const [newUsername, setNewUsername] = useState('');

  // Estados de interacciones y comentarios
  const [interactions, setInteractions] = useState({});
  const [selectedPostForComments, setSelectedPostForComments] = useState(null);
  const [comments, setComments] = useState([]);
  const [newCommentContent, setNewCommentContent] = useState('');
  const [isCommentsModal, setIsCommentsModal] = useState(false);

  // Estados para conteo y último comentario por post: { [postId]: { count: 0, lastComment: null } }
  const [postCommentsMeta, setPostCommentsMeta] = useState({});

  // Estados para ver perfiles de otros usuarios (Muro propio)
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [selectedUsername, setSelectedUsername] = useState('');

  // Estado para visor de imagen en pantalla completa
  const [fullScreenImageUri, setFullScreenImageUri] = useState(null);
  const [isFullScreenModal, setIsFullScreenModal] = useState(false);

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
        .select(`
          id,
          content,
          media_url,
          created_at,
          user_id,
          profiles (
            username,
            avatar_url
          )
        `)
        .order('created_at', { ascending: false });

      if (!postsError && postsData) {
        setPosts(postsData);
        fetchPostsCommentsMeta(postsData);
      }

      const { count, error: countError } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      if (!countError) setTotalUsersCount(count || 0);
    } catch (e) {
      console.log('Error cargando datos:', e.message);
    }
  };

  const fetchPostsCommentsMeta = async (postsList) => {
    try {
      const metaMap = {};
      for (let post of postsList) {
        const { data, count, error } = await supabase
          .from('comments')
          .select(`
            id,
            content,
            created_at,
            profiles (
              username
            )
          `, { count: 'exact' })
          .eq('post_id', post.id)
          .order('created_at', { ascending: false });

        if (!error && data) {
          metaMap[post.id] = {
            count: count || data.length,
            lastComment: data.length > 0 ? data[0] : null
          };
        } else {
          metaMap[post.id] = { count: 0, lastComment: null };
        }
      }
      setPostCommentsMeta(metaMap);
    } catch (e) {
      console.log('Error cargando metadatos de comentarios:', e.message);
    }
  };

  const fetchComments = async (postId) => {
    try {
      const { data, error } = await supabase
        .from('comments')
        .select(`
          id,
          content,
          created_at,
          profiles (
            username,
            avatar_url
          )
        `)
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (!error && data) {
        setComments(data);
      }
    } catch (e) {
      console.log('Error cargando comentarios:', e.message);
    }
  };

  const handleOpenComments = (post) => {
    setSelectedPostForComments(post);
    setIsCommentsModal(true);
    fetchComments(post.id);
  };

  const handleOpenUserProfile = (userId, username) => {
    setSelectedUserId(userId);
    setSelectedUsername(username || 'Usuario');
    setCurrentTab('userProfile');
  };

  const handleOpenFullScreenImage = (uri) => {
    setFullScreenImageUri(uri);
    setIsFullScreenModal(true);
  };

  const handleCreateComment = async () => {
    if (!newCommentContent.trim() || !selectedPostForComments) return;

    try {
      // 1. Insertar el comentario incluyendo el perfil del usuario actual para actualizar el estado instantáneamente
      const { data, error } = await supabase.from('comments').insert([
        {
          post_id: selectedPostForComments.id,
          user_id: session.user.id,
          content: newCommentContent.trim()
        }
      ]).select(`
        id,
        content,
        created_at,
        profiles (
          username,
          avatar_url
        )
      `);

      if (error) throw error;

      // 2. Limpiar input
      setNewCommentContent('');

      // 3. Recargar comentarios del modal actual
      await fetchComments(selectedPostForComments.id);

      // 4. Actualizar inmediatamente los metadatos del feed (conteo y último comentario)
      if (data && data.length > 0) {
        const newCommentItem = data[0];
        setPostCommentsMeta(prev => {
          const currentMeta = prev[selectedPostForComments.id] || { count: 0 };
          return {
            ...prev,
            [selectedPostForComments.id]: {
              count: currentMeta.count + 1,
              lastComment: {
                content: newCommentItem.content,
                profiles: { username: session.user.user_metadata?.username || username }
              }
            }
          };
        });
      }

      // Opcional: refrescar metadatos completos para asegurar sincronización con la BD
      fetchPostsCommentsMeta(posts);

    } catch (error) {
      Alert.alert('Error', 'No se pudo enviar el comentario: ' + error.message);
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

  // Función reutilizable para renderizar tarjetas de post con el último comentario fijado
  const renderPostItem = ({ item }) => {
    const itemInteractions = interactions[item.id] || { sameProcess: 0, support: 0, join: 0 };
    const profile = item.profiles || {};
    const avatarUri = profile.avatar_url || 'https://via.placeholder.com/150';
    const commentMeta = postCommentsMeta[item.id] || { count: 0, lastComment: null };

    return (
      <View style={styles.postCard}>
        {/* Encabezado del Post: Avatar, Nombre y Fecha (Clickeable para ver muro) */}
        <View style={styles.postHeaderRow}>
          <TouchableOpacity 
            style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
            onPress={() => handleOpenUserProfile(item.user_id, profile.username)}
          >
            <Image source={{ uri: avatarUri }} style={styles.postAvatar} />
            <View style={styles.postHeaderText}>
              <Text style={styles.postUser}>@{profile.username || 'Usuario'}</Text>
              <Text style={styles.postDate}>{formatFecha(item.created_at)}</Text>
            </View>
          </TouchableOpacity>
        </View>

        <Text style={styles.postContent}>{item.content}</Text>
        
        {item.media_url ? (
          <TouchableOpacity onPress={() => handleOpenFullScreenImage(item.media_url)}>
            <Image source={{ uri: item.media_url }} style={styles.postImage} resizeMode="contain" />
          </TouchableOpacity>
        ) : null}

        {/* Sección del último comentario fijado y conteo */}
        <View style={styles.commentsPreviewContainer}>
          <TouchableOpacity onPress={() => handleOpenComments(item)} style={styles.commentsPreviewHeader}>
            <Text style={styles.commentsCountText}>💬 Comentarios ({commentMeta.count})</Text>
            <Text style={styles.viewAllCommentsText}>Ver todos →</Text>
          </TouchableOpacity>

          {commentMeta.lastComment ? (
            <View style={styles.lastCommentBox}>
              <Text style={styles.lastCommentUser}>@{commentMeta.lastComment.profiles?.username || 'Usuario'}:</Text>
              <Text style={styles.lastCommentText} numberOfLines={2}>{commentMeta.lastComment.content}</Text>
            </View>
          ) : (
            <Text style={styles.noCommentsPreviewText}>No hay comentarios aún. ¡Sé el primero en opinar!</Text>
          )}
        </View>

        {/* Botones de interacción y comentarios */}
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

          <TouchableOpacity 
            style={styles.actionBtnComments}
            onPress={() => handleOpenComments(item)}
          >
            <Text style={styles.actionIcon}>💬</Text>
            <Text style={styles.actionLabel}>Comentar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
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
                renderItem={renderPostItem}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>No hay publicaciones aún. ¡Sé el primero en compartir tu avance!</Text>
                }
              />
            </View>
          )}

          {currentTab === 'userProfile' && (
            <View style={{ flex: 1, width: '100%' }}>
              <View style={styles.feedHeader}>
                <TouchableOpacity onPress={() => setCurrentTab('feed')} style={{ marginBottom: 8 }}>
                  <Text style={{ color: '#8B5CF6', fontWeight: 'bold' }}>← Volver al Feed</Text>
                </TouchableOpacity>
                <Text style={styles.sectionTitle}>Muro de @{selectedUsername}</Text>
              </View>

              <FlatList
                data={posts.filter(p => p.user_id === selectedUserId)}
                keyExtractor={(item) => item.id ? item.id.toString() : Math.random().toString()}
                renderItem={renderPostItem}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>Este usuario aún no ha publicado ningún avance.</Text>
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

        {/* MODAL DE COMENTARIOS */}
        <Modal visible={isCommentsModal} animationType="slide" transparent={true}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { height: '80%' }]}>
              <View style={styles.commentsModalHeader}>
                <Text style={styles.sectionTitle}>Comentarios</Text>
                <TouchableOpacity onPress={() => setIsCommentsModal(false)}>
                  <Text style={{ color: '#8B5CF6', fontWeight: 'bold', fontSize: 16 }}>Cerrar</Text>
                </TouchableOpacity>
              </View>

              <FlatList
                data={comments}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => {
                  const commentProfile = item.profiles || {};
                  const commentAvatar = commentProfile.avatar_url || 'https://via.placeholder.com/150';
                  return (
                    <View style={styles.commentItem}>
                      <Image source={{ uri: commentAvatar }} style={styles.commentAvatar} />
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={styles.commentUser}>@{commentProfile.username || 'Usuario'}</Text>
                          <Text style={styles.commentDate}>{formatFecha(item.created_at)}</Text>
                        </View>
                        <Text style={styles.commentText}>{item.content}</Text>
                      </View>
                    </View>
                  );
                }}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>No hay comentarios aún. ¡Sé el primero en opinar!</Text>
                }
                style={{ flex: 1, marginVertical: 10 }}
              />

              <View style={styles.commentInputContainer}>
                <TextInput
                  style={styles.commentInput}
                  placeholder="Escribe un comentario..."
                  placeholderTextColor="#94A3B8"
                  value={newCommentContent}
                  onChangeText={setNewCommentContent}
                />
                <TouchableOpacity style={styles.commentSendButton} onPress={handleCreateComment}>
                  <Text style={styles.buttonText}>Enviar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* MODAL PARA VER IMAGEN EN TAMAÑO COMPLETO */}
        <Modal visible={isFullScreenModal} animationType="fade" transparent={true}>
          <View style={styles.fullScreenOverlay}>
            <TouchableOpacity 
              style={styles.closeFullScreenButton} 
              onPress={() => setIsFullScreenModal(false)}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 }}>✕ Cerrar</Text>
            </TouchableOpacity>
            {fullScreenImageUri ? (
              <Image 
                source={{ uri: fullScreenImageUri }} 
                style={styles.fullScreenImage} 
                resizeMode="contain" 
              />
            ) : null}
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
  postHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  postAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: 10, backgroundColor: '#334155' },
  postHeaderText: { flexDirection: 'column' },
  postUser: { color: '#8B5CF6', fontWeight: 'bold', fontSize: 14 },
  postDate: { color: '#64748B', fontSize: 11 },
  postContent: { color: '#F8FAFC', fontSize: 15, marginBottom: 12 },
  postImage: { width: '100%', height: 280, borderRadius: 8, marginBottom: 12, backgroundColor: '#0F172A' },
  commentsPreviewContainer: { backgroundColor: '#0F172A', borderRadius: 8, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: '#334155' },
  commentsPreviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  commentsCountText: { color: '#8B5CF6', fontWeight: 'bold', fontSize: 12 },
  viewAllCommentsText: { color: '#94A3B8', fontSize: 12, textDecorationLine: 'underline' },
  lastCommentBox: { flexDirection: 'row', flexWrap: 'wrap' },
  lastCommentUser: { color: '#8B5CF6', fontWeight: 'bold', fontSize: 12, marginRight: 6 },
  lastCommentText: { color: '#E2E8F0', fontSize: 12, flex: 1 },
  noCommentsPreviewText: { color: '#64748B', fontSize: 12, fontStyle: 'italic' },
  interactionBar: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#334155', paddingTop: 10 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0F172A', paddingHorizontal: 6, paddingVertical: 6, borderRadius: 8 },
  actionBtnComments: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#334155', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8 },
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
  modalContent: { backgroundColor: '#0F172A', padding: 24, borderRadius: 16, borderWidth: 1, borderColor: '#334155' },
  commentsModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#1E293B', paddingBottom: 10 },
  commentItem: { flexDirection: 'row', marginBottom: 14, borderBottomWidth: 1, borderBottomColor: '#1E293B', paddingBottom: 10 },
  commentAvatar: { width: 30, height: 30, borderRadius: 15, marginRight: 10, backgroundColor: '#334155' },
  commentUser: { color: '#8B5CF6', fontWeight: 'bold', fontSize: 13 },
  commentDate: { color: '#64748B', fontSize: 10 },
  commentText: { color: '#F8FAFC', fontSize: 13, marginTop: 4 },
  commentInputContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  commentInput: { flex: 1, backgroundColor: '#1E293B', color: '#FFFFFF', padding: 12, borderRadius: 8, marginRight: 8, borderWidth: 1, borderColor: '#334155' },
  commentSendButton: { backgroundColor: '#8B5CF6', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, justifyContent: 'center' },
  fullScreenOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  closeFullScreenButton: { position: 'absolute', top: 40, right: 20, zIndex: 10, backgroundColor: '#1E293B', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  fullScreenImage: { width: '100%', height: '80%' }
});