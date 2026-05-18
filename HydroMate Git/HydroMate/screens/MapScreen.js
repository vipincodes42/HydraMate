import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { refillStations } from '../data/refillStations';
import { addReviewForStation, getReviewsForStation, getUserFriendsList, getUserProfile } from '../db';
import { auth } from '../firebase';

// ─── Theme ────────────────────────────────────────────────────────────────────
const GREEN       = '#2E7D52';
const GREEN_LIGHT = '#E8F5EE';
const BLUE        = '#2563EB';   // user-location marker — kept distinct from green stations
const CREAM       = '#F5F2ED';
const CARD_BG     = '#FFFFFF';
const TEXT_DARK   = '#1A1A1A';
const TEXT_MID    = '#555555';
const TEXT_MUTED  = '#888888';

// ─── Layout ───────────────────────────────────────────────────────────────────
const MAP_HEIGHT = Math.round(Dimensions.get('window').height * 0.42);

// ─── Map style ────────────────────────────────────────────────────────────────
const lightMapStyle = [
  { elementType: 'geometry',           stylers: [{ color: '#eaf1e6' }] },
  { elementType: 'labels.text.fill',   stylers: [{ color: '#3d5040' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#f5f5f0' }] },
  { featureType: 'road',               elementType: 'geometry',         stylers: [{ color: '#ffffff' }] },
  { featureType: 'road',               elementType: 'labels.text.fill', stylers: [{ color: '#5a6b5c' }] },
  { featureType: 'road.highway',       elementType: 'geometry',         stylers: [{ color: '#d4e8d0' }] },
  { featureType: 'water',              elementType: 'geometry',         stylers: [{ color: '#a8d5b5' }] },
  { featureType: 'poi.park',           elementType: 'geometry.fill',    stylers: [{ color: '#c8e6c9' }] },
  { featureType: 'landscape.natural',  elementType: 'geometry',         stylers: [{ color: '#dce8d8' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry',         stylers: [{ color: '#eaf1e6' }] },
  { featureType: 'administrative',     elementType: 'geometry.stroke',  stylers: [{ color: '#b0c4b1' }] },
  { featureType: 'poi',                elementType: 'labels',           stylers: [{ visibility: 'off' }] },
];

// ─── Haversine distance (miles) ───────────────────────────────────────────────
function distanceMiles(lat1, lng1, lat2, lng2) {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function avgRating(reviews) {
  if (!reviews || reviews.length === 0) return null;
  return (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1);
}

// Resolve a reviewer's display label from their profile node.
// Prefers @username; falls back to displayName → email → "Anonymous".
// Old reviews with no userId / no profile safely render as "Anonymous".
function reviewerLabel(profile) {
  if (!profile) return 'Anonymous';
  if (profile.username)    return `@${profile.username}`;
  if (profile.displayName) return profile.displayName;
  if (profile.email)       return profile.email;
  return 'Anonymous';
}

// First letter of a reviewer's name, for the small avatar circle.
function reviewerInitial(profile) {
  const label = reviewerLabel(profile).replace(/^@/, '');
  return (label[0] || '?').toUpperCase();
}

// Render a 0–5 rating as filled/empty stars for clean, consistent display.
function starString(rating) {
  const n = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

// ─── Station list card ────────────────────────────────────────────────────────
function StationCard({ station, reviews, isActive, locationLoading, onPress }) {
  const count = reviews?.length ?? 0;
  const avg   = avgRating(reviews);
  const dist  = station.distanceMiles;

  let metaText;
  if (locationLoading) {
    metaText = null;
  } else if (dist !== undefined) {
    metaText = dist < 0.1
      ? `< 0.1 mi${count > 0 ? ` · ${count} ${count === 1 ? 'review' : 'reviews'}` : ''}`
      : `${dist.toFixed(1)} mi${count > 0 ? ` · ${count} ${count === 1 ? 'review' : 'reviews'}` : ''}`;
  } else {
    metaText = count > 0 ? `${count} ${count === 1 ? 'review' : 'reviews'}` : 'No reviews yet';
  }

  return (
    <Pressable style={[styles.card, isActive && styles.cardActive]} onPress={onPress}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardName} numberOfLines={1}>{station.name}</Text>
        {avg !== null && (
          <View style={styles.ratingBadge}>
            <Text style={styles.ratingBadgeText}>★ {avg}</Text>
          </View>
        )}
      </View>

      <View style={styles.cardMeta}>
        <Ionicons name="location-outline" size={12} color={TEXT_MUTED} style={{ marginRight: 3 }} />
        {locationLoading ? (
          <ActivityIndicator size="small" color={GREEN} style={{ marginLeft: 2 }} />
        ) : (
          <Text style={styles.cardMetaText}>{metaText}</Text>
        )}
      </View>

      {count === 0 && !locationLoading && (
        <Text style={styles.noReviewsText}>No reviews yet</Text>
      )}
    </Pressable>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function MapScreen() {
  const [reviewsMap,         setReviewsMap]         = useState({});
  const [myFriendIds,        setMyFriendIds]         = useState([]);

  // Cache of reviewer profiles, keyed by uid. Built once per uid and reused
  // across renders so we never re-fetch the same profile while scrolling.
  const [profiles,           setProfiles]           = useState({});

  // Store only the ID — prevents stale object refs from causing re-renders
  const [activeStationId,    setActiveStationId]     = useState(null);

  const [userLocation,       setUserLocation]        = useState(null);
  const [locationLoading,    setLocationLoading]     = useState(true);
  const [locationError,      setLocationError]       = useState(null);

  const [reviewModalVisible, setReviewModalVisible]  = useState(false);
  const [selectedStation,    setSelectedStation]     = useState(null);
  const [modalMode,          setModalMode]           = useState('list');
  const [draftRating,        setDraftRating]         = useState(5);
  const [draftComment,       setDraftComment]        = useState('');
  const [isSubmitting,       setIsSubmitting]        = useState(false);
  const [reviewFilterMode,   setReviewFilterMode]    = useState('all');

  const listRef             = useRef(null);
  // Imperative handle on the MapView — used to animate to the user's location.
  const mapRef              = useRef(null);
  // Tracks which uids have already been fetched (or are in flight) so a uid is
  // only ever requested from Firebase once, no matter how many reviews use it.
  const requestedProfileIds = useRef(new Set());
  // Guard: prevents MapView.onPress from clearing selection when a marker was just tapped.
  // Both Marker.onPress and MapView.onPress fire as separate native events; the map press
  // would otherwise null out activeStationId immediately after the marker press set it.
  const markerJustPressed   = useRef(false);

  // ── Derived: full station object for the active ID ──────────────────────────
  const activeStation = useMemo(
    () => refillStations.find((s) => s.id === activeStationId) ?? null,
    [activeStationId]
  );

  // ── Fetch any reviewer profiles we don't already have cached ─────────────────
  // Accepts an array of reviews, collects their uids, and fetches only the ones
  // not yet requested. Keeps Firebase reads to one per unique user.
  const loadMissingProfiles = useCallback(async (reviews) => {
    const ids = [...new Set((reviews || []).map((r) => r.userId).filter(Boolean))]
      .filter((id) => !requestedProfileIds.current.has(id));
    if (ids.length === 0) return;

    ids.forEach((id) => requestedProfileIds.current.add(id));
    const entries = await Promise.all(
      ids.map(async (id) => [id, await getUserProfile(id)])
    );
    setProfiles((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
  }, []);

  // ── Boot ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      const map = {};
      await Promise.all(
        refillStations.map(async (s) => {
          map[s.id] = await getReviewsForStation(s.id);
        })
      );
      setReviewsMap(map);

      // Warm the profile cache for every reviewer across all stations.
      loadMissingProfiles(Object.values(map).flat());

      const uid = auth.currentUser?.uid;
      if (uid) setMyFriendIds(await getUserFriendsList(uid));

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocationError('Enable location to see nearest stations.');
          setLocationLoading(false);
          return;
        }
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setUserLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      } catch {
        setLocationError('Could not get your location.');
      } finally {
        setLocationLoading(false);
      }
    }
    init();
  }, [loadMissingProfiles]);

  // ── Sorted stations ──────────────────────────────────────────────────────────
  const sortedStations = useMemo(() => {
    if (!userLocation) return refillStations;
    return [...refillStations]
      .map((s) => ({
        ...s,
        distanceMiles: distanceMiles(
          userLocation.lat, userLocation.lng, s.latitude, s.longitude
        ),
      }))
      .sort((a, b) => a.distanceMiles - b.distanceMiles);
  }, [userLocation]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  // Marker tapped: set the ref BEFORE state update so the map's onPress guard fires
  const handleMarkerPress = useCallback((stationId) => {
    const station = refillStations.find((s) => s.id === stationId);
    console.log(
      '[Marker] pressed | id:', stationId,
      '| name:', station?.name,
      '| lat:', station?.latitude,
      '| lng:', station?.longitude,
      '| activeStationId was:', activeStationId,
    );
    markerJustPressed.current = true;
    setActiveStationId(stationId);
    const idx = sortedStations.findIndex((s) => s.id === stationId);
    if (idx >= 0 && listRef.current) {
      listRef.current.scrollToIndex({ index: idx, animated: true, viewPosition: 0.1 });
    }
  }, [sortedStations, activeStationId]);

  // Map background tapped: only dismiss if it was truly an open-area tap
  const handleMapPress = useCallback(() => {
    if (markerJustPressed.current) {
      // This press was the map event that trails a marker tap — swallow it
      markerJustPressed.current = false;
      console.log('[Map] onPress swallowed (marker just pressed)');
      return;
    }
    console.log('[Map] onPress → clearing selection');
    setActiveStationId(null);
  }, []);

  const openReviewModal = useCallback((station, mode) => {
    setSelectedStation(station);
    setModalMode(mode);
    setReviewFilterMode('all');
    setDraftRating(5);
    setDraftComment('');
    setReviewModalVisible(true);
  }, []);

  const submitReview = async () => {
    if (!selectedStation) return;
    setIsSubmitting(true);
    try {
      await addReviewForStation(
        selectedStation.id, draftRating, draftComment, auth.currentUser?.uid
      );
      const fresh = await getReviewsForStation(selectedStation.id);
      setReviewsMap((prev) => ({ ...prev, [selectedStation.id]: fresh }));
      // Make sure the just-added reviewer's profile is cached for display.
      loadMissingProfiles(fresh);
      setReviewModalVisible(false);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Markers — rendered from refillStations so coordinates are always stable.
  // tracksViewChanges is intentionally omitted (defaults to true on both platforms).
  // Flipping it false→true when isActive changes caused the native layer to recapture
  // the view before layout completed, placing the marker at the map's screen origin.
  const markerElements = useMemo(() => refillStations.map((station) => {
    const revs     = reviewsMap[station.id] || [];
    const avg      = avgRating(revs);
    const isActive = station.id === activeStationId;

    return (
      <Marker
        key={station.id}
        coordinate={{ latitude: station.latitude, longitude: station.longitude }}
        onPress={() => handleMarkerPress(station.id)}
      >
        <View style={styles.markerRoot}>
          <View style={[styles.markerPin, isActive && styles.markerPinActive]}>
            <Ionicons name="water" size={14} color={isActive ? '#FFFFFF' : GREEN} />
          </View>
          {avg !== null && (
            <View style={[styles.markerLabel, isActive && styles.markerLabelActive]}>
              <Text style={[styles.markerLabelText, isActive && styles.markerLabelTextActive]}>
                {avg}
              </Text>
            </View>
          )}
        </View>
      </Marker>
    );
  }), [reviewsMap, activeStationId, handleMarkerPress]);

  // ── Station detail tray (active station info above the list) ─────────────────
  const activeTray = useMemo(() => {
    if (!activeStation) return null;
    const revs  = reviewsMap[activeStation.id] || [];
    const count = revs.length;
    const avg   = avgRating(revs);
    const dist  = sortedStations.find((s) => s.id === activeStation.id)?.distanceMiles;

    return (
      <View style={styles.tray}>
        <View style={styles.trayBody}>
          <View style={styles.trayTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.trayLabel}>WATER REFILL STATION</Text>
              <Text style={styles.trayName} numberOfLines={2}>{activeStation.name}</Text>
              <View style={styles.trayMeta}>
                {dist !== undefined && (
                  <>
                    <Ionicons name="location-outline" size={12} color={TEXT_MUTED} />
                    <Text style={styles.trayMetaText}>{dist < 0.1 ? '< 0.1 mi' : `${dist.toFixed(1)} mi`}</Text>
                    <Text style={styles.trayMetaDot}>·</Text>
                  </>
                )}
                {avg !== null ? (
                  <Text style={styles.trayMetaText}>⭐ {avg} ({count} {count === 1 ? 'review' : 'reviews'})</Text>
                ) : (
                  <Text style={styles.trayMetaText}>No reviews yet</Text>
                )}
              </View>
            </View>

            <Pressable style={styles.trayClose} onPress={() => setActiveStationId(null)} hitSlop={12}>
              <Ionicons name="close" size={18} color={TEXT_MUTED} />
            </Pressable>
          </View>

          <View style={styles.trayBtnRow}>
            <Pressable
              style={styles.trayBtnOutline}
              onPress={() => openReviewModal(activeStation, 'list')}
            >
              <Text style={styles.trayBtnOutlineText}>View Reviews</Text>
            </Pressable>
            <Pressable
              style={styles.trayBtnFill}
              onPress={() => openReviewModal(activeStation, 'write')}
            >
              <Text style={styles.trayBtnFillText}>Rate Station</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }, [activeStation, reviewsMap, sortedStations, openReviewModal]);

  // ── Recenter the map on the user's current location ──────────────────────────
  // No-ops gracefully if location is unavailable (permission denied / not ready).
  const centerOnUser = useCallback(() => {
    if (!userLocation || !mapRef.current) return;
    mapRef.current.animateToRegion(
      {
        latitude: userLocation.lat,
        longitude: userLocation.lng,
        latitudeDelta: 0.012,
        longitudeDelta: 0.012,
      },
      500
    );
  }, [userLocation]);

  // ── Card renderer ────────────────────────────────────────────────────────────
  const renderCard = useCallback(({ item }) => (
    <StationCard
      station={item}
      reviews={reviewsMap[item.id]}
      isActive={item.id === activeStationId}
      locationLoading={locationLoading && !userLocation && !locationError}
      onPress={() => {
        setActiveStationId(item.id);
        openReviewModal(item, 'list');
      }}
    />
  ), [reviewsMap, activeStationId, locationLoading, userLocation, locationError, openReviewModal]);

  // ── Derived review summary for the station shown in the modal ────────────────
  const modalReviews = reviewsMap[selectedStation?.id] || [];
  const modalAvg     = avgRating(modalReviews);
  const modalCount   = modalReviews.length;

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>

      {/* ── MAP ───────────────────────────────────────────────────────────── */}
      <View style={{ height: MAP_HEIGHT }}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFillObject}
          initialRegion={{
            latitude: 32.8801,
            longitude: -117.237,
            latitudeDelta: 0.018,
            longitudeDelta: 0.018,
          }}
          customMapStyle={lightMapStyle}
          onPress={handleMapPress}
        >
          {markerElements}

          {/* ── USER LOCATION — distinct blue dot, only when location is known ── */}
          {userLocation && (
            <Marker
              coordinate={{ latitude: userLocation.lat, longitude: userLocation.lng }}
              title="You are here"
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View style={styles.userMarkerRing}>
                <View style={styles.userMarkerDot} />
              </View>
            </Marker>
          )}
        </MapView>

        {/* ── RECENTER BUTTON — shown once we have the user's location ───────── */}
        {userLocation && (
          <Pressable style={styles.locateBtn} onPress={centerOnUser} hitSlop={8}>
            <Ionicons name="locate" size={20} color={GREEN} />
          </Pressable>
        )}
      </View>

      {/* ── STATION DETAIL TRAY (shown when a marker/card is selected) ────── */}
      {activeTray}

      {/* ── NEARBY STATIONS LIST ────────────────────────────────────────── */}
      <View style={styles.listWrapper}>
        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>nearby stations</Text>
          <View style={styles.filterPill}>
            <Ionicons name="filter-outline" size={12} color={TEXT_MID} />
            <Text style={styles.filterPillText}>filter</Text>
          </View>
        </View>

        {locationError ? (
          <View style={styles.locationBanner}>
            <Ionicons name="location-outline" size={14} color="#7A5F00" style={{ marginRight: 4 }} />
            <Text style={styles.locationBannerText}>{locationError}</Text>
          </View>
        ) : null}

        <FlatList
          ref={listRef}
          data={sortedStations}
          keyExtractor={(s) => String(s.id)}
          renderItem={renderCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onScrollToIndexFailed={() => {}}
        />
      </View>

      {/* ── REVIEW MODAL ────────────────────────────────────────────────── */}
      <Modal visible={reviewModalVisible} animationType="slide" transparent>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              {/* ── Header — station name always shown clearly at the top ──── */}
              <Text style={styles.modalLabel}>
                {modalMode === 'list' ? 'WATER REFILL STATION' : 'RATE THIS STATION'}
              </Text>
              <Text style={styles.modalStationName} numberOfLines={2}>
                {selectedStation?.name}
              </Text>

              {modalMode === 'list' ? (
                <>
                  {/* ── Summary card — average rating + total review count ── */}
                  <View style={styles.summaryCard}>
                    <View style={styles.summaryBlock}>
                      <Text style={styles.summaryAvg}>{modalAvg ?? '—'}</Text>
                      <Text style={styles.summaryStars}>{starString(modalAvg)}</Text>
                    </View>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryBlock}>
                      <Text style={styles.summaryCount}>{modalCount}</Text>
                      <Text style={styles.summaryCountLabel}>
                        {modalCount === 1 ? 'review' : 'reviews'}
                      </Text>
                    </View>
                  </View>

                  {/* ── Filter tabs ───────────────────────────────────────── */}
                  <View style={styles.filterTabContainer}>
                    <Pressable
                      style={[styles.filterTab, reviewFilterMode === 'all' && styles.filterTabActive]}
                      onPress={() => setReviewFilterMode('all')}
                    >
                      <Text style={[styles.filterTabText, reviewFilterMode === 'all' && styles.filterTabTextActive]}>
                        All Reviews
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[styles.filterTab, reviewFilterMode === 'friends' && styles.filterTabActive]}
                      onPress={() => setReviewFilterMode('friends')}
                    >
                      <Text style={[styles.filterTabText, reviewFilterMode === 'friends' && styles.filterTabTextActive]}>
                        Friends Only
                      </Text>
                    </Pressable>
                  </View>

                  {reviewFilterMode === 'friends' && (
                    <Text style={styles.friendsHint}>
                      Showing reviews from your friends only
                    </Text>
                  )}

                  <ScrollView style={styles.reviewsListContainer} showsVerticalScrollIndicator={false}>
                    {(() => {
                      let revs = reviewsMap[selectedStation?.id] || [];
                      if (reviewFilterMode === 'friends') {
                        revs = revs.filter((r) => myFriendIds.includes(r.userId));
                      }
                      if (revs.length === 0) {
                        return (
                          <View style={styles.emptyStateContainer}>
                            <Ionicons
                              name={reviewFilterMode === 'all' ? 'water-outline' : 'people-outline'}
                              size={34}
                              color={GREEN}
                              style={{ marginBottom: 10 }}
                            />
                            <Text style={styles.emptyReviewsText}>
                              {reviewFilterMode === 'all'
                                ? 'No reviews yet. Be the first to leave one!'
                                : 'No friend reviews yet.'}
                            </Text>
                          </View>
                        );
                      }
                      return revs.map((r, i) => (
                        <View key={i} style={styles.reviewCard}>
                          <View style={styles.reviewCardHeader}>
                            <View style={styles.reviewAvatar}>
                              <Text style={styles.reviewAvatarText}>
                                {reviewerInitial(profiles[r.userId])}
                              </Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.reviewCardAuthor} numberOfLines={1}>
                                {reviewerLabel(profiles[r.userId])}
                              </Text>
                              {r.createdAt ? (
                                <Text style={styles.reviewCardDate}>
                                  {new Date(r.createdAt).toLocaleDateString()}
                                </Text>
                              ) : null}
                            </View>
                            <Text style={styles.reviewCardStars}>{starString(r.rating)}</Text>
                          </View>
                          {r.comment
                            ? <Text style={styles.reviewCardComment}>{r.comment}</Text>
                            : <Text style={styles.reviewCardCommentEmpty}>No comment left</Text>
                          }
                        </View>
                      ));
                    })()}
                  </ScrollView>

                  <View style={styles.modalBtnRow}>
                    <Pressable style={styles.cancelBtn} onPress={() => setReviewModalVisible(false)}>
                      <Text style={styles.cancelBtnText}>Close</Text>
                    </Pressable>
                    <Pressable
                      style={styles.submitBtn}
                      onPress={() => { setModalMode('write'); setDraftRating(5); setDraftComment(''); }}
                    >
                      <Text style={styles.submitBtnText}>Write Review</Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.writeHint}>How was your experience?</Text>
                  <View style={styles.starRow}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Pressable key={star} onPress={() => setDraftRating(star)} hitSlop={6}>
                        <Text style={[styles.star, star <= draftRating && styles.starSelected]}>★</Text>
                      </Pressable>
                    ))}
                  </View>

                  <TextInput
                    style={styles.modalInput}
                    placeholder="Write a short comment... (optional)"
                    placeholderTextColor={TEXT_MUTED}
                    value={draftComment}
                    onChangeText={setDraftComment}
                    multiline
                    maxLength={250}
                  />

                  <Pressable style={styles.submitBtnFull} onPress={submitReview} disabled={isSubmitting}>
                    {isSubmitting
                      ? <ActivityIndicator color="#FFFFFF" />
                      : <Text style={styles.submitBtnFullText}>Submit Review</Text>
                    }
                  </Pressable>
                  <Pressable
                    style={styles.cancelLink}
                    onPress={() => setReviewModalVisible(false)}
                    disabled={isSubmitting}
                  >
                    <Text style={styles.cancelLinkText}>Cancel</Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CREAM,
  },

  // ── Markers ──────────────────────────────────────────────────────────────────
  markerRoot: { alignItems: 'center' },
  markerPin: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: GREEN_LIGHT,
    borderWidth: 2,
    borderColor: GREEN,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 3,
    elevation: 4,
  },
  markerPinActive: {
    // Only override paint properties — never dimensions.
    // Any change to width/height/borderRadius shifts the layout bounds, causing
    // react-native-maps to recalculate the anchor and misplace the marker.
    backgroundColor: GREEN,
    borderColor: '#FFFFFF',
  },
  markerLabel: {
    marginTop: 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  markerLabelActive: {
    backgroundColor: GREEN,
    borderColor: GREEN,
  },
  markerLabelText: {
    fontSize: 10,
    fontWeight: '700',
    color: TEXT_DARK,
  },
  markerLabelTextActive: {
    color: '#FFFFFF',
  },

  // ── User location marker ──────────────────────────────────────────────────────
  // A blue dot with white border, sitting inside a soft translucent halo — clearly
  // distinct from the green water-station pins. Static (no animation) so the
  // native marker view is captured once and never misplaced.
  userMarkerRing: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(37, 99, 235, 0.22)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userMarkerDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: BLUE,
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 4,
  },

  // ── Recenter-on-user button ───────────────────────────────────────────────────
  locateBtn: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: CARD_BG,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },

  // ── Station detail tray ───────────────────────────────────────────────────────
  tray: {
    backgroundColor: CARD_BG,
    borderTopWidth: 1,
    borderTopColor: '#E0DDD8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 6,
  },
  trayBody: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
  },
  trayTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  trayLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: GREEN,
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  trayName: {
    fontSize: 17,
    fontWeight: '700',
    color: TEXT_DARK,
    marginBottom: 4,
    flex: 1,
  },
  trayMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trayMetaText: {
    fontSize: 12,
    color: TEXT_MUTED,
  },
  trayMetaDot: {
    fontSize: 12,
    color: TEXT_MUTED,
  },
  trayClose: {
    marginLeft: 8,
    padding: 4,
  },
  trayBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  trayBtnOutline: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: GREEN,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  trayBtnOutlineText: {
    color: GREEN,
    fontWeight: '700',
    fontSize: 13,
  },
  trayBtnFill: {
    flex: 1,
    backgroundColor: GREEN,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  trayBtnFillText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },

  // ── Nearby stations section ───────────────────────────────────────────────────
  listWrapper: {
    flex: 1,
    backgroundColor: CREAM,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT_DARK,
    letterSpacing: -0.3,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: CARD_BG,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E0DDD8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 2,
    elevation: 1,
  },
  filterPillText: {
    fontSize: 12,
    color: TEXT_MID,
    fontWeight: '500',
  },
  locationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#FFF8E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  locationBannerText: {
    fontSize: 13,
    color: '#7A5F00',
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },

  // ── Station card ──────────────────────────────────────────────────────────────
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
  },
  cardActive: {
    borderColor: GREEN,
    shadowOpacity: 0.13,
    shadowRadius: 8,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  cardName: {
    fontSize: 15,
    fontWeight: '700',
    color: TEXT_DARK,
    flex: 1,
    marginRight: 8,
  },
  ratingBadge: {
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    minWidth: 36,
    alignItems: 'center',
  },
  ratingBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B45309',
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  cardMetaText: {
    fontSize: 12,
    color: TEXT_MUTED,
  },
  noReviewsText: {
    fontSize: 12,
    color: TEXT_MUTED,
    fontStyle: 'italic',
    marginTop: 2,
  },

  // ── Review modal — light cream / green scheme ─────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(26, 26, 26, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: CREAM,
    width: '100%',
    borderRadius: 22,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 12,
  },
  modalLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: GREEN,
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  modalStationName: {
    fontSize: 20,
    fontWeight: '800',
    color: TEXT_DARK,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 18,
    letterSpacing: -0.3,
  },

  // ── Summary card ──────────────────────────────────────────────────────────────
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: CARD_BG,
    borderRadius: 16,
    paddingVertical: 16,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryBlock: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    height: 38,
    backgroundColor: '#E8E4DD',
  },
  summaryAvg: {
    fontSize: 28,
    fontWeight: '800',
    color: TEXT_DARK,
  },
  summaryStars: {
    fontSize: 13,
    color: '#F5A623',
    marginTop: 2,
  },
  summaryCount: {
    fontSize: 28,
    fontWeight: '800',
    color: GREEN,
  },
  summaryCountLabel: {
    fontSize: 12,
    color: TEXT_MUTED,
    marginTop: 4,
  },

  // ── Filter tabs ───────────────────────────────────────────────────────────────
  filterTabContainer: {
    flexDirection: 'row',
    backgroundColor: '#EAE6DE',
    borderRadius: 12,
    padding: 4,
    marginBottom: 14,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 9,
  },
  filterTabActive: {
    backgroundColor: CARD_BG,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  filterTabText:       { color: TEXT_MUTED, fontWeight: '700', fontSize: 12 },
  filterTabTextActive: { color: GREEN },
  friendsHint: {
    fontSize: 12,
    color: TEXT_MUTED,
    fontStyle: 'italic',
    marginBottom: 10,
    marginLeft: 2,
  },

  reviewsListContainer: {
    maxHeight: 320,
    marginBottom: 18,
  },
  emptyStateContainer: {
    paddingVertical: 44,
    alignItems: 'center',
  },
  emptyReviewsText: {
    color: TEXT_MID,
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 20,
  },

  // ── Review card ───────────────────────────────────────────────────────────────
  reviewCard: {
    backgroundColor: CARD_BG,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  reviewCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 10,
  },
  reviewAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: GREEN_LIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewAvatarText: {
    color: GREEN,
    fontSize: 15,
    fontWeight: '800',
  },
  reviewCardAuthor:       { color: TEXT_DARK, fontSize: 14, fontWeight: '700' },
  reviewCardStars:        { fontSize: 13, color: '#F5A623' },
  reviewCardDate:         { color: TEXT_MUTED, fontSize: 12, marginTop: 1 },
  reviewCardComment:      { color: TEXT_MID, fontSize: 14, lineHeight: 20 },
  reviewCardCommentEmpty: { color: TEXT_MUTED, fontSize: 13, fontStyle: 'italic' },

  // ── Write-review form ─────────────────────────────────────────────────────────
  writeHint: {
    fontSize: 14,
    color: TEXT_MID,
    textAlign: 'center',
    marginBottom: 12,
  },
  starRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
    gap: 10,
  },
  star:         { fontSize: 42, color: '#D8D2C6' },
  starSelected: { color: '#F5A623' },
  modalInput: {
    backgroundColor: CARD_BG,
    color: TEXT_DARK,
    borderRadius: 16,
    padding: 16,
    minHeight: 110,
    textAlignVertical: 'top',
    fontSize: 14,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#E8E4DD',
  },

  // ── Buttons ───────────────────────────────────────────────────────────────────
  modalBtnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: GREEN,
    borderRadius: 28,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelBtnText: { color: GREEN, fontWeight: '700', fontSize: 15 },
  submitBtn: {
    flex: 1,
    backgroundColor: GREEN,
    borderRadius: 28,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  submitBtnFull: {
    backgroundColor: GREEN,
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: GREEN,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnFullText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
  cancelLink: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelLinkText: { color: TEXT_MUTED, fontWeight: '600', fontSize: 14 },
});
