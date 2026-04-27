import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import { FlatList, Text, View, StyleSheet, Pressable, TextInput, ActivityIndicator, Modal, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { getFriendsData, searchUsers, sendFriendRequest, getPendingRequests, respondToFriendRequest, getRecentUserReviews } from '../db';
import { auth } from '../firebase';

export default function FriendsScreen() {
    const [activeTab, setActiveTab] = useState('friends');
    const [loading, setLoading] = useState(false);
    
    const [friends, setFriends] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [pendingReqs, setPendingReqs] = useState([]);
    
    // Modal states
    const [selectedFriend, setSelectedFriend] = useState(null);
    const [friendReviews, setFriendReviews] = useState([]);
    const [modalVisible, setModalVisible] = useState(false);

    const uid = auth.currentUser?.uid;

    const loadData = async () => {
        if (!uid) return;
        setLoading(true);
        try {
            if (activeTab === 'friends') {
                const data = await getFriendsData(uid);
                setFriends(data.sort((a, b) => (b.live?.totalDrankML ?? b.live?.totalDrunkML ?? 0) - (a.live?.totalDrankML ?? a.live?.totalDrunkML ?? 0)));
            } else if (activeTab === 'pending') {
                const reqs = await getPendingRequests(uid);
                setPendingReqs(reqs);
            }
        } catch(e) {}
        setLoading(false);
    };

    useEffect(() => {
        loadData();
    }, [uid, activeTab]);

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        setLoading(true);
        try {
            const results = await searchUsers(searchQuery.trim(), uid);
            setSearchResults(results);
        } catch(e) {}
        setLoading(false);
    };

    const handleSendReq = async (receiverId) => {
        try {
            await sendFriendRequest(uid, receiverId);
            alert("Request sent!");
        } catch(e) {
            alert(e.message);
        }
    };

    const handleRespondReq = async (senderId, accept) => {
        try {
            await respondToFriendRequest(uid, senderId, accept);
            loadData();
        } catch(e) {
            alert("Error responding to request");
        }
    };

    const openFriendModal = async (friend) => {
        setSelectedFriend(friend);
        const revs = await getRecentUserReviews(friend.uid);
        setFriendReviews(revs);
        setModalVisible(true);
    };

    const renderTabs = () => (
        <View style={styles.tabContainer}>
            <Pressable style={[styles.tab, activeTab === 'friends' && styles.activeTab]} onPress={() => setActiveTab('friends')}>
                <Text style={[styles.tabText, activeTab === 'friends' && styles.activeTabText]}>My Friends</Text>
            </Pressable>
            <Pressable style={[styles.tab, activeTab === 'add' && styles.activeTab]} onPress={() => setActiveTab('add')}>
                <Text style={[styles.tabText, activeTab === 'add' && styles.activeTabText]}>Add</Text>
            </Pressable>
            <Pressable style={[styles.tab, activeTab === 'pending' && styles.activeTab]} onPress={() => setActiveTab('pending')}>
                <Text style={[styles.tabText, activeTab === 'pending' && styles.activeTabText]}>Pending</Text>
            </Pressable>
        </View>
    );

    return (
        <LinearGradient colors={['#0A1628', '#0D2137', '#0A1628']} style={styles.container}>
            <Text style={styles.headerTitle}>Friends 💧</Text>
            {renderTabs()}

            {/* MY FRIENDS */}
            {activeTab === 'friends' && (
                <FlatList
                    data={friends}
                    keyExtractor={(item) => item.uid}
                    ListEmptyComponent={loading ? <ActivityIndicator color="#4FC3F7"/> : <Text style={styles.emptyText}>No friends yet.</Text>}
                    renderItem={({ item, index }) => {
                        const ml = item.live?.totalDrankML ?? item.live?.totalDrunkML ?? 0;
                        const pct = Math.min(ml / 2000, 1);
                        return (
                            <Pressable 
                                style={styles.friendCard}
                                onPress={() => openFriendModal(item)}
                            >
                                <Text style={styles.rankEmoji}>
                                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '💧'}
                                </Text>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.friendName}>{item.displayName ?? 'Friend'}</Text>
                                    <View style={styles.barWrap}>
                                        <View style={[styles.barFill, { width: `${pct * 100}%` }]} />
                                    </View>
                                </View>
                                <Text style={styles.amountText}>{ml} mL</Text>
                            </Pressable>
                        );
                    }}
                />
            )}

            {/* ADD FRIENDS */}
            {activeTab === 'add' && (
                <View style={{ flex: 1 }}>
                    <View style={styles.searchRow}>
                        <TextInput 
                            style={styles.searchInput}
                            placeholder="Email or @username..."
                            placeholderTextColor="#546E8A"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />
                        <Pressable style={styles.searchBtn} onPress={handleSearch}>
                            <Text style={styles.searchBtnText}>Search</Text>
                        </Pressable>
                    </View>
                    {loading && <ActivityIndicator color="#4FC3F7" style={{marginTop: 20}} />}
                    <FlatList
                        data={searchResults}
                        keyExtractor={(i) => i.uid}
                        renderItem={({ item }) => (
                            <View style={styles.userCard}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.friendName}>{item.displayName}</Text>
                                    <Text style={styles.emailText}>{item.email}</Text>
                                </View>
                                <Pressable style={styles.actionBtn} onPress={() => handleSendReq(item.uid)}>
                                    <Text style={styles.actionBtnText}>Add</Text>
                                </Pressable>
                            </View>
                        )}
                    />
                </View>
            )}

            {/* PENDING REQUESTS */}
            {activeTab === 'pending' && (
                <FlatList
                    data={pendingReqs}
                    keyExtractor={(i) => i.uid}
                    ListEmptyComponent={loading ? <ActivityIndicator color="#4FC3F7"/> : <Text style={styles.emptyText}>No pending requests.</Text>}
                    renderItem={({ item }) => (
                        <View style={styles.userCard}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.friendName}>{item.displayName}</Text>
                                <Text style={styles.emailText}>{item.email}</Text>
                            </View>
                            <Pressable style={[styles.actionBtn, {backgroundColor: '#4CAF50', marginRight: 8}]} onPress={() => handleRespondReq(item.uid, true)}>
                                <Text style={styles.actionBtnText}>Accept</Text>
                            </Pressable>
                            <Pressable style={[styles.actionBtn, {backgroundColor: '#F44336'}]} onPress={() => handleRespondReq(item.uid, false)}>
                                <Text style={styles.actionBtnText}>Reject</Text>
                            </Pressable>
                        </View>
                    )}
                />
            )}

            {/* FRIEND MODAL */}
            <Modal visible={modalVisible} animationType="slide" transparent>
                <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <Text style={styles.modalTitle}>{selectedFriend?.displayName}'s Profile</Text>
                            
                            <View style={styles.statsCard}>
                                <Text style={styles.statLine}>💧 Logged: {selectedFriend?.live?.totalDrankML ?? selectedFriend?.live?.totalDrunkML ?? 0} mL</Text>
                                <Text style={styles.statLine}>🎯 Goal: 2000 mL</Text>
                                <Text style={styles.statLine}>📊 Bar: {Math.round(Math.min((selectedFriend?.live?.totalDrankML ?? selectedFriend?.live?.totalDrunkML ?? 0) / 2000, 1) * 100)}% Full</Text>
                            </View>

                            <Text style={styles.reviewsTitle}>Recent Ratings</Text>
                            <FlatList 
                                style={{ maxHeight: 250, width: '100%', marginBottom: 16 }}
                                data={friendReviews}
                                keyExtractor={(i) => i.reviewId}
                                ListEmptyComponent={<Text style={styles.emptyText}>No recent reviews.</Text>}
                                renderItem={({ item }) => (
                                    <View style={styles.reviewCard}>
                                        <Text style={styles.revStars}>{'⭐'.repeat(item.rating)}</Text>
                                        <Text style={styles.revComment}>{item.comment || "Rated without comment."}</Text>
                                    </View>
                                )}
                            />
                            
                            <Pressable style={styles.closeBtn} onPress={() => setModalVisible(false)}>
                                <Text style={styles.closeBtnText}>Close</Text>
                            </Pressable>
                        </View>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20 },
    headerTitle: { color: '#fff', fontSize: 22, fontWeight: '700', marginTop: 60, marginBottom: 16 },
    tabContainer: { flexDirection: 'row', backgroundColor: '#0D2137', borderRadius: 8, padding: 4, marginBottom: 20 },
    tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 6 },
    activeTab: { backgroundColor: '#4FC3F7' },
    tabText: { color: '#546E8A', fontWeight: 'bold' },
    activeTabText: { color: '#0A1628' },
    emptyText: { color: '#546E8A', textAlign: 'center', marginTop: 40, fontStyle: 'italic' },
    friendCard: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, backgroundColor: '#0D2137', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#1E3A5F' },
    rankEmoji: { fontSize: 22, marginRight: 10 },
    friendName: { color: '#fff', fontWeight: '600', fontSize: 16 },
    barWrap: { height: 6, backgroundColor: '#1E3A5F', borderRadius: 3, marginTop: 6, overflow: 'hidden' },
    barFill: { height: '100%', backgroundColor: '#4FC3F7', borderRadius: 3 },
    amountText: { color: '#4FC3F7', marginLeft: 10, fontWeight: '700' },
    searchRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
    searchInput: { flex: 1, backgroundColor: '#0D2137', color: '#fff', borderRadius: 8, paddingHorizontal: 16, height: 48, borderWidth: 1, borderColor: '#1E3A5F' },
    searchBtn: { backgroundColor: '#4FC3F7', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16, borderRadius: 8 },
    searchBtnText: { color: '#0A1628', fontWeight: 'bold' },
    userCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0D2137', padding: 14, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#1E3A5F' },
    emailText: { color: '#546E8A', fontSize: 12, marginTop: 4 },
    actionBtn: { backgroundColor: '#4FC3F7', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6 },
    actionBtnText: { color: '#0A1628', fontWeight: 'bold', fontSize: 12 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(10,22,40,0.8)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: '#0D2137', borderRadius: 16, padding: 24, borderWidth: 1, borderColor: '#1E3A5F' },
    modalTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
    statsCard: { backgroundColor: '#0A1628', padding: 16, borderRadius: 12, marginBottom: 20 },
    statLine: { color: '#4FC3F7', fontWeight: '600', marginBottom: 8 },
    reviewsTitle: { color: '#546E8A', fontWeight: 'bold', textTransform: 'uppercase', fontSize: 12, marginBottom: 10 },
    reviewCard: { backgroundColor: '#0A1628', padding: 12, borderRadius: 8, marginBottom: 8 },
    revStars: { fontSize: 12, marginBottom: 4 },
    revComment: { color: '#fff', fontSize: 13 },
    closeBtn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#4FC3F7', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
    closeBtnText: { color: '#4FC3F7', fontWeight: 'bold' }
});
