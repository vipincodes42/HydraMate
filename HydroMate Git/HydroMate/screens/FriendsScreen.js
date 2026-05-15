import { Ionicons } from '@expo/vector-icons';
import { get, ref } from 'firebase/database';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import { db } from '../firebase';
import {
    getFriendsData,
    getPendingRequests,
    getRecentUserReviews,
    respondToFriendRequest,
    searchUsers,
    sendFriendRequest,
} from '../db';
import { auth } from '../firebase';

const TEAM_GOAL_ML = 10000;
const DAILY_GOAL_ML = 2000;

const AVATAR_EMOJIS = ['🐱', '🐶', '🦊', '🐸', '🐼', '🦁', '🐯', '🐻', '🐨', '🦋'];

function getAvatar(name) {
    return AVATAR_EMOJIS[(name?.charCodeAt(0) ?? 0) % AVATAR_EMOJIS.length];
}

function getMl(live) {
    return live?.totalDrankML ?? live?.totalDrunkML ?? 0;
}

export default function FriendsScreen() {
    const [friends, setFriends] = useState([]);
    const [currentUserLive, setCurrentUserLive] = useState(null);
    const [currentUserProfile, setCurrentUserProfile] = useState(null);
    const [pendingReqs, setPendingReqs] = useState([]);
    const [loading, setLoading] = useState(false);

    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [showAddModal, setShowAddModal] = useState(false);

    const [selectedFriend, setSelectedFriend] = useState(null);
    const [friendReviews, setFriendReviews] = useState([]);
    const [profileModalVisible, setProfileModalVisible] = useState(false);

    const uid = auth.currentUser?.uid;

    const loadData = async () => {
        if (!uid) return;
        setLoading(true);
        try {
            const [friendsData, pending, profileSnap, liveSnap] = await Promise.all([
                getFriendsData(uid),
                getPendingRequests(uid),
                get(ref(db, `users/${uid}/profile`)),
                get(ref(db, `users/${uid}/live`)),
            ]);
            setFriends(
                friendsData.sort((a, b) => getMl(b.live) - getMl(a.live))
            );
            setPendingReqs(pending);
            setCurrentUserProfile(profileSnap.val());
            setCurrentUserLive(liveSnap.val());
        } catch (e) {
            console.error('[FriendsScreen] loadData error:', e);
        }
        setLoading(false);
    };

    useEffect(() => {
        loadData();
    }, [uid]);

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        setLoading(true);
        try {
            const results = await searchUsers(searchQuery.trim(), uid);
            setSearchResults(results);
        } catch (e) {
            console.error('[FriendsScreen] search error:', e);
        }
        setLoading(false);
    };

    const handleSendReq = async (receiverId) => {
        try {
            await sendFriendRequest(uid, receiverId);
            alert('Request sent!');
        } catch (e) {
            alert(e.message);
        }
    };

    const handleRespondReq = async (senderId, accept) => {
        try {
            await respondToFriendRequest(uid, senderId, accept);
            await loadData();
        } catch (e) {
            alert(`Error responding to request: ${e?.message ?? e}`);
        }
    };

    const openFriendModal = async (friend) => {
        setSelectedFriend(friend);
        const revs = await getRecentUserReviews(friend.uid);
        setFriendReviews(revs);
        setProfileModalVisible(true);
    };

    // Build leaderboard: friends + current user combined and sorted
    const myEntry = {
        uid,
        displayName: currentUserProfile?.displayName ?? 'You',
        live: currentUserLive,
        isMe: true,
    };
    const leaderboard = [...friends, myEntry].sort(
        (a, b) => getMl(b.live) - getMl(a.live)
    );

    // Team challenge totals
    const teamTotal = leaderboard.reduce((sum, f) => sum + getMl(f.live), 0);
    const teamPct = Math.min(teamTotal / TEAM_GOAL_ML, 1);

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {/* ── Header ── */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.title}>friends</Text>
                        <Text style={styles.subtitle}>stay hydrated together</Text>
                    </View>
                    <Pressable style={styles.addCircleBtn} onPress={() => setShowAddModal(true)}>
                        <Ionicons name="person-add-outline" size={20} color="#fff" />
                        {pendingReqs.length > 0 && (
                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>{pendingReqs.length}</Text>
                            </View>
                        )}
                    </Pressable>
                </View>

                {/* ── Team Challenge Card ── */}
                <View style={styles.challengeCard}>
                    <View style={styles.challengeHeaderRow}>
                        <Ionicons name="trophy-outline" size={17} color="#fff" style={{ marginRight: 6 }} />
                        <Text style={styles.challengeTitle}>team challenge</Text>
                    </View>
                    <Text style={styles.challengeSub}>collective hydration goal</Text>
                    <View style={styles.challengeMlRow}>
                        <Text style={styles.challengeMl}>{teamTotal.toLocaleString()}ml</Text>
                        <Text style={styles.challengeGoal}> / {TEAM_GOAL_ML.toLocaleString()}ml</Text>
                    </View>
                    <View style={styles.challengeBarBg}>
                        <View style={[styles.challengeBarFill, { width: `${teamPct * 100}%` }]} />
                    </View>
                    <Text style={styles.challengeFooter}>
                        {Math.round(teamPct * 100)}% complete • keep it up!
                    </Text>
                </View>

                {/* ── Today's Leaderboard ── */}
                <View style={styles.card}>
                    <View style={styles.cardHeaderRow}>
                        <Ionicons name="people-outline" size={16} color="#888" style={{ marginRight: 6 }} />
                        <Text style={styles.cardTitle}>today's leaderboard</Text>
                    </View>

                    {loading && friends.length === 0 ? (
                        <ActivityIndicator color="#6BAD6A" style={{ marginVertical: 20 }} />
                    ) : (
                        leaderboard.map((item, index) => {
                            const ml = getMl(item.live);
                            const pct = Math.min(ml / DAILY_GOAL_ML, 1);
                            return (
                                <Pressable
                                    key={item.uid}
                                    style={[styles.friendRow, item.isMe && styles.friendRowHighlight]}
                                    onPress={() => !item.isMe && openFriendModal(item)}
                                    disabled={item.isMe}
                                >
                                    <View style={styles.avatarCircle}>
                                        <Text style={styles.avatarEmoji}>{getAvatar(item.displayName)}</Text>
                                    </View>
                                    <View style={styles.friendInfo}>
                                        <View style={styles.nameRow}>
                                            <Text style={styles.friendName}>{item.displayName ?? 'Friend'}</Text>
                                            {item.isMe && (
                                                <View style={styles.youBadge}>
                                                    <Text style={styles.youBadgeText}>you</Text>
                                                </View>
                                            )}
                                        </View>
                                        <View style={styles.progressBarBg}>
                                            <View style={[styles.progressBarFill, { width: `${pct * 100}%` }]} />
                                        </View>
                                    </View>
                                    <Text style={styles.mlText}>{ml}ml</Text>
                                    <Text style={styles.rankText}>#{index + 1}</Text>
                                </Pressable>
                            );
                        })
                    )}

                    {!loading && leaderboard.length === 1 && (
                        <Text style={styles.emptyHint}>Add friends to grow the leaderboard!</Text>
                    )}
                </View>

                {/* ── Friend Requests (if any) ── */}
                {pendingReqs.length > 0 && (
                    <View style={{ marginBottom: 4 }}>
                        <Text style={styles.sectionLabel}>friend requests</Text>
                        {pendingReqs.map((item) => (
                            <View key={item.uid} style={styles.suggestedRow}>
                                <View style={styles.avatarCircle}>
                                    <Ionicons name="person-outline" size={18} color="#aaa" />
                                </View>
                                <View style={styles.suggestedInfo}>
                                    <Text style={styles.suggestedName}>{item.displayName}</Text>
                                    <Text style={styles.suggestedSub}>{item.email}</Text>
                                </View>
                                <Pressable
                                    style={styles.addGreenBtn}
                                    onPress={() => handleRespondReq(item.uid, true)}
                                >
                                    <Text style={styles.addGreenBtnText}>accept</Text>
                                </Pressable>
                                <Pressable
                                    style={[styles.addGreenBtn, styles.declineBtn]}
                                    onPress={() => handleRespondReq(item.uid, false)}
                                >
                                    <Text style={[styles.addGreenBtnText, styles.declineBtnText]}>decline</Text>
                                </Pressable>
                            </View>
                        ))}
                    </View>
                )}

                <View style={{ height: 24 }} />
            </ScrollView>

            {/* ── Add Friend Modal (bottom sheet) ── */}
            <Modal visible={showAddModal} animationType="slide" transparent>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={{ flex: 1 }}
                >
                <TouchableWithoutFeedback onPress={() => { setShowAddModal(false); Keyboard.dismiss(); }}>
                    <View style={styles.modalOverlay}>
                        <TouchableWithoutFeedback>
                            <View style={styles.bottomSheet}>
                                <View style={styles.sheetHandle} />
                                <Text style={styles.sheetTitle}>find friends</Text>
                                <View style={styles.searchRow}>
                                    <TextInput
                                        style={styles.searchInput}
                                        placeholder="Email or @username..."
                                        placeholderTextColor="#bbb"
                                        value={searchQuery}
                                        onChangeText={setSearchQuery}
                                        keyboardType="email-address"
                                        autoCapitalize="none"
                                        returnKeyType="search"
                                        onSubmitEditing={handleSearch}
                                    />
                                    <Pressable style={styles.searchBtn} onPress={handleSearch}>
                                        <Text style={styles.searchBtnText}>search</Text>
                                    </Pressable>
                                </View>

                                {loading && <ActivityIndicator color="#6BAD6A" style={{ marginTop: 12 }} />}

                                {searchResults.map((item) => (
                                    <View key={item.uid} style={styles.searchResultRow}>
                                        <View style={styles.avatarCircle}>
                                            <Ionicons name="person-outline" size={18} color="#aaa" />
                                        </View>
                                        <View style={{ flex: 1, marginLeft: 12 }}>
                                            <Text style={styles.resultName}>{item.displayName}</Text>
                                            <Text style={styles.resultSub}>
                                                {item.username ? `@${item.username}` : item.email}
                                            </Text>
                                        </View>
                                        <Pressable style={styles.addGreenBtn} onPress={() => handleSendReq(item.uid)}>
                                            <Text style={styles.addGreenBtnText}>add</Text>
                                        </Pressable>
                                    </View>
                                ))}

                                {searchResults.length === 0 && !loading && searchQuery.trim() !== '' && (
                                    <Text style={styles.noResultsText}>No users found for "{searchQuery}"</Text>
                                )}

                                <Pressable style={styles.sheetCloseBtn} onPress={() => setShowAddModal(false)}>
                                    <Text style={styles.sheetCloseBtnText}>close</Text>
                                </Pressable>
                            </View>
                        </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
                </KeyboardAvoidingView>
            </Modal>

            {/* ── Friend Profile Modal ── */}
            <Modal visible={profileModalVisible} animationType="slide" transparent>
                <TouchableWithoutFeedback onPress={() => { setProfileModalVisible(false); Keyboard.dismiss(); }}>
                    <View style={styles.modalOverlay}>
                        <TouchableWithoutFeedback>
                            <View style={styles.bottomSheet}>
                                <View style={styles.sheetHandle} />

                                <View style={styles.profileHeader}>
                                    <View style={[styles.avatarCircle, styles.avatarLarge]}>
                                        <Text style={styles.avatarEmojiLarge}>
                                            {getAvatar(selectedFriend?.displayName)}
                                        </Text>
                                    </View>
                                    <Text style={styles.sheetTitle}>{selectedFriend?.displayName}</Text>
                                </View>

                                <View style={styles.profileStatBox}>
                                    <Text style={styles.profileStatLabel}>today's intake</Text>
                                    <Text style={styles.profileStatValue}>
                                        {getMl(selectedFriend?.live)} mL
                                    </Text>
                                    <View style={styles.progressBarBg}>
                                        <View
                                            style={[
                                                styles.progressBarFill,
                                                { width: `${Math.min(getMl(selectedFriend?.live) / DAILY_GOAL_ML, 1) * 100}%` },
                                            ]}
                                        />
                                    </View>
                                    <Text style={styles.profileStatGoal}>goal: {DAILY_GOAL_ML} mL</Text>
                                </View>

                                <Text style={styles.sectionLabel}>recent station reviews</Text>
                                {friendReviews.length === 0 ? (
                                    <Text style={styles.emptyHint}>No reviews yet.</Text>
                                ) : (
                                    friendReviews.slice(0, 4).map((r) => (
                                        <View key={r.reviewId} style={styles.reviewRow}>
                                            <Text style={styles.revStars}>{'⭐'.repeat(r.rating)}</Text>
                                            <Text style={styles.revComment}>{r.comment || 'No comment.'}</Text>
                                        </View>
                                    ))
                                )}

                                <Pressable style={styles.sheetCloseBtn} onPress={() => setProfileModalVisible(false)}>
                                    <Text style={styles.sheetCloseBtnText}>close</Text>
                                </Pressable>
                            </View>
                        </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>
        </SafeAreaView>
    );
}

const GREEN = '#6BAD6A';
const CREAM = '#FAF8F5';
const DARK = '#1A1A2E';
const GRAY = '#888888';

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: CREAM },
    container: { flex: 1, backgroundColor: CREAM },
    content: { paddingHorizontal: 20, paddingBottom: 40 },

    // Header
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginTop: 16,
        marginBottom: 22,
    },
    title: { fontSize: 30, fontWeight: '800', color: DARK, letterSpacing: -0.5 },
    subtitle: { fontSize: 13, color: GRAY, marginTop: 3 },
    addCircleBtn: {
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: GREEN,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: GREEN,
        shadowOpacity: 0.35,
        shadowOffset: { width: 0, height: 3 },
        shadowRadius: 6,
        elevation: 4,
    },
    badge: {
        position: 'absolute',
        top: -2,
        right: -2,
        backgroundColor: '#E53935',
        borderRadius: 8,
        minWidth: 16,
        height: 16,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 3,
    },
    badgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },

    // Team Challenge Card
    challengeCard: {
        backgroundColor: GREEN,
        borderRadius: 18,
        padding: 20,
        marginBottom: 20,
        shadowColor: GREEN,
        shadowOpacity: 0.3,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 10,
        elevation: 5,
    },
    challengeHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
    challengeTitle: { color: '#fff', fontWeight: '700', fontSize: 16 },
    challengeSub: { color: 'rgba(255,255,255,0.78)', fontSize: 13, marginBottom: 14 },
    challengeMlRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 12 },
    challengeMl: { color: '#fff', fontSize: 30, fontWeight: '800' },
    challengeGoal: { color: 'rgba(255,255,255,0.65)', fontSize: 15, marginLeft: 2 },
    challengeBarBg: {
        height: 8,
        backgroundColor: 'rgba(255,255,255,0.28)',
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: 10,
    },
    challengeBarFill: { height: '100%', backgroundColor: '#fff', borderRadius: 4 },
    challengeFooter: { color: 'rgba(255,255,255,0.88)', fontSize: 12 },

    // White Card
    card: {
        backgroundColor: '#fff',
        borderRadius: 18,
        padding: 16,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 8,
        elevation: 2,
    },
    cardHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
    cardTitle: { fontSize: 14, fontWeight: '600', color: GRAY },

    // Friend Row (leaderboard)
    friendRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 9,
        paddingHorizontal: 4,
        borderRadius: 10,
    },
    friendRowHighlight: { backgroundColor: '#F0F7EF' },
    avatarCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F0EDE8',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    avatarEmoji: { fontSize: 20 },
    avatarLarge: { width: 56, height: 56, borderRadius: 28 },
    avatarEmojiLarge: { fontSize: 28 },
    friendInfo: { flex: 1 },
    nameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
    friendName: { fontSize: 15, fontWeight: '600', color: DARK },
    youBadge: {
        backgroundColor: GREEN,
        borderRadius: 5,
        paddingHorizontal: 7,
        paddingVertical: 2,
        marginLeft: 8,
    },
    youBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
    progressBarBg: {
        height: 5,
        backgroundColor: '#EBEBEB',
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressBarFill: { height: '100%', backgroundColor: GREEN, borderRadius: 3 },
    mlText: { color: GRAY, fontSize: 13, marginLeft: 10, marginRight: 4 },
    rankText: { color: '#BBB', fontSize: 13, fontWeight: '700', width: 30, textAlign: 'right' },

    emptyHint: { color: '#BBB', textAlign: 'center', marginVertical: 14, fontSize: 13 },

    // Section label
    sectionLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: GRAY,
        marginBottom: 12,
    },

    // Suggested / Request Row
    suggestedRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 14,
        padding: 12,
        marginBottom: 10,
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowOffset: { width: 0, height: 1 },
        shadowRadius: 4,
        elevation: 1,
    },
    suggestedInfo: { flex: 1, marginLeft: 12 },
    suggestedName: { fontSize: 15, fontWeight: '600', color: DARK },
    suggestedSub: { fontSize: 12, color: GRAY, marginTop: 2 },
    addGreenBtn: {
        backgroundColor: GREEN,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    addGreenBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
    declineBtn: { backgroundColor: '#F0F0F0', marginLeft: 8 },
    declineBtnText: { color: GRAY },
    // Modals / bottom sheets
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.35)',
        justifyContent: 'flex-end',
    },
    bottomSheet: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 24,
        paddingTop: 14,
        paddingBottom: 40,
        maxHeight: '85%',
    },
    sheetHandle: {
        width: 40,
        height: 4,
        backgroundColor: '#DDD',
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 18,
    },
    sheetTitle: { fontSize: 20, fontWeight: '700', color: DARK, marginBottom: 16 },

    // Search inside add modal
    searchRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
    searchInput: {
        flex: 1,
        backgroundColor: '#F5F5F5',
        borderRadius: 12,
        paddingHorizontal: 14,
        height: 46,
        color: DARK,
        fontSize: 15,
    },
    searchBtn: {
        backgroundColor: GREEN,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 18,
        borderRadius: 12,
    },
    searchBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    searchResultRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F2F2F2',
    },
    resultName: { fontSize: 15, fontWeight: '600', color: DARK },
    resultSub: { fontSize: 12, color: GRAY, marginTop: 2 },
    noResultsText: { color: '#BBB', textAlign: 'center', marginTop: 12, fontSize: 13 },

    sheetCloseBtn: {
        marginTop: 20,
        paddingVertical: 14,
        alignItems: 'center',
        borderRadius: 12,
        backgroundColor: '#F5F5F5',
    },
    sheetCloseBtnText: { color: GRAY, fontWeight: '600', fontSize: 15 },

    // Profile modal internals
    profileHeader: { alignItems: 'center', marginBottom: 16 },
    profileStatBox: {
        backgroundColor: '#F7F7F7',
        borderRadius: 14,
        padding: 16,
        marginBottom: 16,
    },
    profileStatLabel: { fontSize: 12, color: GRAY, marginBottom: 4 },
    profileStatValue: { fontSize: 26, fontWeight: '800', color: DARK, marginBottom: 10 },
    profileStatGoal: { fontSize: 12, color: GRAY, marginTop: 6 },
    reviewRow: {
        backgroundColor: '#F7F7F7',
        borderRadius: 10,
        padding: 12,
        marginBottom: 8,
    },
    revStars: { fontSize: 12, marginBottom: 4 },
    revComment: { color: '#555', fontSize: 13 },
});
