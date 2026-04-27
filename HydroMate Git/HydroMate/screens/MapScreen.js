import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, Modal, TextInput, Pressable, ActivityIndicator, TouchableWithoutFeedback, Keyboard, ScrollView } from 'react-native';
import MapView, { Marker, Callout } from 'react-native-maps';
import { refillStations } from '../data/refillStations';
import { Colors } from '../constants/theme';
import { getReviewsForStation, addReviewForStation, getUserFriendsList } from '../db';
import { auth } from '../firebase';

const darkMapStyle = [
  { "elementType": "geometry", "stylers": [{ "color": "#0A1628" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#8ec3b9" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#1a3646" }] },
  { "featureType": "administrative.country", "elementType": "geometry.stroke", "stylers": [{ "color": "#4b6878" }] },
  { "featureType": "administrative.land_parcel", "elementType": "labels.text.fill", "stylers": [{ "color": "#64779e" }] },
  { "featureType": "administrative.province", "elementType": "geometry.stroke", "stylers": [{ "color": "#4b6878" }] },
  { "featureType": "landscape.man_made", "elementType": "geometry.stroke", "stylers": [{ "color": "#334e87" }] },
  { "featureType": "landscape.natural", "elementType": "geometry", "stylers": [{ "color": "#023e58" }] },
  { "featureType": "poi", "elementType": "geometry", "stylers": [{ "color": "#283d6a" }] },
  { "featureType": "poi", "elementType": "labels.text.fill", "stylers": [{ "color": "#6f9ba5" }] },
  { "featureType": "poi", "elementType": "labels.text.stroke", "stylers": [{ "color": "#1d2c4d" }] },
  { "featureType": "poi.park", "elementType": "geometry.fill", "stylers": [{ "color": "#023e58" }] },
  { "featureType": "poi.park", "elementType": "labels.text.fill", "stylers": [{ "color": "#3C7680" }] },
  { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#304a7d" }] },
  { "featureType": "road", "elementType": "labels.text.fill", "stylers": [{ "color": "#98a5be" }] },
  { "featureType": "road", "elementType": "labels.text.stroke", "stylers": [{ "color": "#1d2c4d" }] },
  { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#2c6675" }] },
  { "featureType": "road.highway", "elementType": "geometry.stroke", "stylers": [{ "color": "#255763" }] },
  { "featureType": "road.highway", "elementType": "labels.text.fill", "stylers": [{ "color": "#b0d5ce" }] },
  { "featureType": "road.highway", "elementType": "labels.text.stroke", "stylers": [{ "color": "#023e58" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#0e1626" }] },
  { "featureType": "water", "elementType": "labels.text.fill", "stylers": [{ "color": "#4e6d70" }] }
];

export default function MapScreen() {
  const [reviewsMap, setReviewsMap] = useState({});
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState('list'); // 'list' or 'write'
  const [selectedStation, setSelectedStation] = useState(null);
  const [activeStation, setActiveStation] = useState(null); // the map marker clicked
  
  const [draftRating, setDraftRating] = useState(5);
  const [draftComment, setDraftComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [myFriendIds, setMyFriendIds] = useState([]);
  const [reviewFilterMode, setReviewFilterMode] = useState('all'); // 'all' or 'friends'

  useEffect(() => {
    // Fetch initial reviews for all stations concurrently
    async function fetchAllReviews() {
      const map = {};
      await Promise.all(
        refillStations.map(async (station) => {
          const revs = await getReviewsForStation(station.id);
          map[station.id] = revs;
        })
      );
      setReviewsMap(map);
      
      const uid = auth.currentUser?.uid;
      if (uid) {
        const fList = await getUserFriendsList(uid);
        setMyFriendIds(fList);
      }
    }
    fetchAllReviews();
  }, []);

  const openReviewModal = (station, mode) => {
    setSelectedStation(station);
    setModalMode(mode);
    setReviewFilterMode('all'); // reset to default
    setDraftRating(5);
    setDraftComment('');
    setReviewModalVisible(true);
  };

  const submitReview = async () => {
    if (!selectedStation) return;
    setIsSubmitting(true);
    try {
      const currentUid = auth.currentUser?.uid;
      await addReviewForStation(selectedStation.id, draftRating, draftComment, currentUid);
      // Re-fetch immediately to dynamically update the Callout UI
      const freshRevs = await getReviewsForStation(selectedStation.id);
      setReviewsMap(prev => ({
        ...prev,
        [selectedStation.id]: freshRevs
      }));
      setReviewModalVisible(false);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const ucsdRegion = {
    latitude: 32.8801,
    longitude: -117.2340,
    latitudeDelta: 0.02,
    longitudeDelta: 0.02,
  };

  return (
    <View style={styles.container}>
      <MapView 
        style={styles.map} 
        initialRegion={ucsdRegion}
        customMapStyle={darkMapStyle}
        userInterfaceStyle="dark"
        onPress={() => setActiveStation(null)}
      >
        {refillStations.map((station) => {
          const revs = reviewsMap[station.id] || [];
          const count = revs.length;
          const avg = count ? (revs.reduce((sum, r) => sum + r.rating, 0) / count).toFixed(1) : null;

          return (
            <Marker
              key={station.id}
              coordinate={{
                latitude: station.latitude,
                longitude: station.longitude,
              }}
              onPress={(e) => {
                e.stopPropagation();
                setActiveStation(station);
              }}
            >
              <View style={styles.markerRoot}>
                {/* Micro Rating Label */}
                <View style={styles.markerMiniLabel}>
                  <Text style={styles.markerMiniLabelText}>
                    {count > 0 ? `⭐ ${avg}` : "New"}
                  </Text>
                </View>

                {/* Custom Marker Avatar */}
                <View style={styles.markerContainer}>
                  <Text style={styles.markerText}>💧</Text>
                </View>
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* --- BOTTOM ACTION TRAY --- */}
      {activeStation && (
        <View style={styles.trayOverlay}>
          {(() => {
            const revs = reviewsMap[activeStation.id] || [];
            const count = revs.length;
            const avg = count ? (revs.reduce((sum, r) => sum + r.rating, 0) / count).toFixed(1) : null;

            return (
              <View style={styles.trayContent}>
                <Text style={styles.stationLabel}>Water Refill Station</Text>
                <Text style={styles.stationName}>{activeStation.name || "Water Station"}</Text>
                
                {count > 0 ? (
                  <Text style={styles.ratingText}>⭐ {avg} ({count} {count === 1 ? 'review' : 'reviews'})</Text>
                ) : (
                  <Text style={styles.ratingText}>No reviews yet</Text>
                )}

                <Text style={styles.stationDetail}>
                  {activeStation.description || "📍 Location not specified"}
                </Text>

                <View style={styles.calloutBtnRow}>
                  <Pressable style={styles.viewReviewsBtn} onPress={() => openReviewModal(activeStation, 'list')}>
                    <Text style={styles.viewReviewsText}>View Reviews</Text>
                  </Pressable>
                  <Pressable style={styles.leaveReviewBtn} onPress={() => openReviewModal(activeStation, 'write')}>
                    <Text style={styles.leaveReviewText}>Rate Station</Text>
                  </Pressable>
                </View>
              </View>
            );
          })()}
        </View>
      )}

      {/* Review Interactive Modal */}
      <Modal visible={reviewModalVisible} animationType="slide" transparent={true}>
        <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>
                {modalMode === 'list' ? `Reviews` : `Rate ${selectedStation?.name}`}
              </Text>
              
              {modalMode === 'list' ? (
                <>
                  <View style={styles.filterTabContainer}>
                      <Pressable style={[styles.filterTab, reviewFilterMode === 'all' && styles.filterTabActive]} onPress={() => setReviewFilterMode('all')}>
                          <Text style={[styles.filterTabText, reviewFilterMode === 'all' && styles.filterTabTextActive]}>All Ratings</Text>
                      </Pressable>
                      <Pressable style={[styles.filterTab, reviewFilterMode === 'friends' && styles.filterTabActive]} onPress={() => setReviewFilterMode('friends')}>
                          <Text style={[styles.filterTabText, reviewFilterMode === 'friends' && styles.filterTabTextActive]}>Friends' Ratings</Text>
                      </Pressable>
                  </View>
                  
                  {/* -- LIST REVIEWS MODE -- */}
                  <ScrollView style={styles.reviewsListContainer}>
                    {(() => {
                        let revs = selectedStation ? (reviewsMap[selectedStation.id] || []) : [];
                        
                        if (reviewFilterMode === 'friends') {
                            revs = revs.filter(r => myFriendIds.includes(r.userId));
                        }
                        
                        if (revs.length === 0) {
                          return (
                            <View style={styles.emptyStateContainer}>
                              <Text style={styles.emptyReviewsText}>
                                {reviewFilterMode === 'all' ? "No reviews yet. Be the first!" : "None of your friends have rated this station yet."}
                              </Text>
                            </View>
                          );
                        }
                        return revs.map((r, idx) => (
                           <View key={idx} style={styles.reviewCard}>
                             <View style={styles.reviewCardHeader}>
                               <Text style={styles.reviewCardStars}>{'⭐'.repeat(r.rating)}</Text>
                               <Text style={styles.reviewCardDate}>{new Date(r.createdAt).toLocaleDateString()}</Text>
                             </View>
                             {r.comment ? (
                               <Text style={styles.reviewCardComment}>{r.comment}</Text>
                             ) : (
                               <Text style={styles.reviewCardCommentEmpty}>User left no comment</Text>
                             )}
                           </View>
                        ));
                    })()}
                  </ScrollView>
                  <View style={styles.modalBtnRow}>
                    <Pressable style={styles.cancelBtn} onPress={() => setReviewModalVisible(false)}>
                      <Text style={styles.cancelBtnText}>Close</Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <>
                  {/* -- WRITE REVIEW MODE -- */}
                  <View style={styles.starRow}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Pressable key={star} onPress={() => setDraftRating(star)}>
                        <Text style={[styles.star, star <= draftRating && styles.starSelected]}>
                          ★
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <TextInput
                    style={styles.modalInput}
                    placeholder="Write a short comment... (optional)"
                    placeholderTextColor="#A0ABC0"
                    value={draftComment}
                    onChangeText={setDraftComment}
                    multiline
                    maxLength={250}
                  />

                  <View style={styles.modalBtnRow}>
                    <Pressable style={styles.cancelBtn} onPress={() => setReviewModalVisible(false)} disabled={isSubmitting}>
                      <Text style={styles.cancelBtnText}>Cancel</Text>
                    </Pressable>
                    
                    <Pressable style={styles.submitBtn} onPress={submitReview} disabled={isSubmitting}>
                      {isSubmitting ? (
                        <ActivityIndicator color="#0A1628" />
                      ) : (
                        <Text style={styles.submitBtnText}>Submit</Text>
                      )}
                    </Pressable>
                  </View>
                </>
              )}
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A1628',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  trayOverlay: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
  },
  trayContent: {
    backgroundColor: '#0D2137',
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#1E3A5F',
  },
  stationLabel: {
    fontSize: 10,
    color: '#4FC3F7',
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  stationName: {
    fontWeight: 'bold',
    fontSize: 20,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F9A825',
    marginBottom: 6,
  },
  stationDetail: {
    fontSize: 13,
    color: '#546E8A',
    lineHeight: 18,
    marginBottom: 10,
  },
  calloutBtnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  viewReviewsBtn: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#4FC3F7',
    borderRadius: 4,
    paddingVertical: 10,
    alignItems: 'center',
  },
  viewReviewsText: {
    color: '#4FC3F7',
    fontWeight: '700',
    fontSize: 13,
  },
  leaveReviewBtn: {
    flex: 1,
    backgroundColor: '#4FC3F7',
    borderRadius: 4,
    paddingVertical: 10,
    alignItems: 'center',
  },
  leaveReviewText: {
    color: '#0A1628',
    fontWeight: '700',
    fontSize: 13,
  },
  markerRoot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerMiniLabel: {
    backgroundColor: 'rgba(10, 22, 40, 0.85)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#1E3A5F',
  },
  markerMiniLabelText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  markerContainer: {
    backgroundColor: '#4FC3F7',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  markerText: {
    fontSize: 16,
  },

  /* Modal Styles */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 22, 40, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#0D2137',
    width: '100%',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  starRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 24,
    gap: 8,
  },
  star: {
    fontSize: 40,
    color: '#546E8A', 
  },
  starSelected: {
    color: '#F9A825',
  },
  modalInput: {
    backgroundColor: '#0A1628',
    color: '#ffffff',
    borderRadius: 8,
    padding: 16,
    minHeight: 100,
    textAlignVertical: 'top',
    fontSize: 14,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#1E3A5F',
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#4FC3F7',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#4FC3F7',
    fontWeight: 'bold',
    fontSize: 16,
  },
  submitBtn: {
    flex: 1,
    backgroundColor: '#4FC3F7',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: {
    color: '#0A1628',
    fontWeight: 'bold',
    fontSize: 16,
  },
  
  /* Filter specific styling */
  filterTabContainer: {
    flexDirection: 'row',
    backgroundColor: '#0A1628',
    borderRadius: 8,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1E3A5F',
  },
  filterTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 6,
  },
  filterTabActive: {
    backgroundColor: '#4FC3F7',
  },
  filterTabText: {
    color: '#546E8A',
    fontWeight: 'bold',
    fontSize: 12,
  },
  filterTabTextActive: {
    color: '#0A1628',
  },
  
  /* Reviews List Styles */
  reviewsListContainer: {
    maxHeight: 300,
    marginBottom: 20,
  },
  emptyStateContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyReviewsText: {
    color: '#546E8A',
    fontSize: 14,
    fontStyle: 'italic',
  },
  reviewCard: {
    backgroundColor: '#0A1628',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1E3A5F',
  },
  reviewCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reviewCardStars: {
    fontSize: 12,
  },
  reviewCardDate: {
    color: '#546E8A',
    fontSize: 12,
  },
  reviewCardComment: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
  },
  reviewCardCommentEmpty: {
    color: '#546E8A',
    fontSize: 14,
    fontStyle: 'italic',
  }
});