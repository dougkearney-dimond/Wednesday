import React, { useState, useEffect, useRef } from 'react';
import { Calendar, Clock, Trash2, Plus, AlertCircle, ExternalLink, User, X, Archive, FileText, Upload, Download } from 'lucide-react';

// Airtable Configuration - Using secure environment variables
const AIRTABLE_API_KEY = process.env.REACT_APP_AIRTABLE_API_KEY || 'placeholder_api_key';
const AIRTABLE_BASE_ID = process.env.REACT_APP_AIRTABLE_BASE_ID || 'placeholder_base_id';
const AIRTABLE_TABLE_NAME = 'Matches';

// Debug: Log the actual values being used (but mask the API key for security)
console.log('=== AIRTABLE DEBUG INFO ===');
console.log('Base ID:', AIRTABLE_BASE_ID);
console.log('Table Name:', AIRTABLE_TABLE_NAME);
console.log('API Key starts with:', AIRTABLE_API_KEY.substring(0, 8) + '...');
console.log('Full URL:', `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_NAME}`);
console.log('Has API Key:', !!AIRTABLE_API_KEY && AIRTABLE_API_KEY !== 'placeholder_api_key');
console.log('Has Base ID:', !!AIRTABLE_BASE_ID && AIRTABLE_BASE_ID !== 'placeholder_base_id');
console.log('Environment variables loaded:', {
  'REACT_APP_AIRTABLE_API_KEY': !!process.env.REACT_APP_AIRTABLE_API_KEY,
  'REACT_APP_AIRTABLE_BASE_ID': !!process.env.REACT_APP_AIRTABLE_BASE_ID
});

// Test different table names
console.log('Testing URLs:');
console.log('1.', `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Matches`);
console.log('2.', `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/matches`);
console.log('3.', `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Table%201`);
console.log('Copy one of these URLs and test it in your browser with your API token');
console.log('===============================');

// Airtable API configuration
const airtableHeaders = {
  'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
  'Content-Type': 'application/json'
};

const airtableUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_NAME}`;

const DimondTennisApp = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentView, setCurrentView] = useState('matches');
  const [organizedMatches, setOrganizedMatches] = useState([]);
  const [archivedMatches, setArchivedMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef(null);

  // Signup modal state
  const [signupModal, setSignupModal] = useState({ isOpen: false, matchId: null, playerName: '' });

  // Results modal state
  const [resultsModal, setResultsModal] = useState({
    isOpen: false,
    matchId: null,
    teams: [
      { player1: '', player2: '' },
      { player1: '', player2: '' },
      { player1: '', player2: '' },
      { player1: '', player2: '' }
    ],
    scores: {
      set1: { match1: { team1: '', team2: '' }, match2: { team1: '', team2: '' } },
      set2: { match1: { team1: '', team2: '' }, match2: { team1: '', team2: '' } },
      set3: { match1: { team1: '', team2: '' }, match2: { team1: '', team2: '' } }
    }
  });

  const [receiptsModal, setReceiptsModal] = useState({
    isOpen: false,
    matchId: null,
    receipts: ['', ''],
    receiptNames: ['', ''],
    courts: 1
  });

  const [viewingPdf, setViewingPdf] = useState({ isOpen: false, data: null, title: '' });

  const [newMatch, setNewMatch] = useState({
    date: '',
    time: '',
    organizer: '',
    courts: 2,  // Default to 2 courts
    receipts: ['', ''],
    receiptNames: ['', '']
  });

  // Helper functions
  const getPlayerLimit = (courts) => courts === 1 ? 4 : 8;

  const viewReceipt = async (receiptData, title = 'Court Receipt') => {
    if (!receiptData) return;

    // Detection for Airtable truncation (100k limit)
    const isTruncated = typeof receiptData === 'string' && receiptData.length >= 99000;

    try {
      let finalUrl = receiptData;
      let isBlob = false;

      if (receiptData.startsWith('data:')) {
        const response = await fetch(receiptData);
        const blob = await response.blob();
        finalUrl = URL.createObjectURL(blob);
        isBlob = true;
      }

      setViewingPdf({
        isOpen: true,
        data: finalUrl,
        title: title,
        originalData: receiptData,
        isTruncated: isTruncated,
        isBlob: isBlob
      });
    } catch (error) {
      console.error('Error preparing PDF viewer:', error);
      setViewingPdf({
        isOpen: true,
        data: receiptData,
        title: title,
        originalData: receiptData,
        isTruncated: isTruncated,
        isBlob: false
      });
    }
  };

  const formatDate = (dateString) => {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatShortDate = (dateString) => {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const compressImage = (base64Str) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxDimension = 1200;

          if (width > height) {
            if (width > maxDimension) {
              height *= maxDimension / width;
              width = maxDimension;
            }
          } else {
            if (height > maxDimension) {
              width *= maxDimension / height;
              height = maxDimension;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.6));
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () => reject(new Error('Image failed to load for compression'));
    });
  };

  // Check if a match should be archived (day after it occurred)
  // Check if a match should be archived (day after it occurred)
  const shouldArchiveMatch = (matchDate) => {
    const today = new Date();

    // Parse YYYY-MM-DD manually to ensure local time
    const [year, month, day] = matchDate.split('-').map(Number);
    const match = new Date(year, month - 1, day);

    const dayAfterMatch = new Date(match);
    dayAfterMatch.setDate(match.getDate() + 1);

    // Archive if today is the day after the match or later
    return today >= dayAfterMatch;
  };

  // Sort matches by proximity to today
  const sortByProximityToToday = (matches) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time to start of day for consistent comparison

    return matches.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      dateA.setHours(0, 0, 0, 0);
      dateB.setHours(0, 0, 0, 0);

      // Calculate absolute difference in days from today
      const diffA = Math.abs(dateA - today);
      const diffB = Math.abs(dateB - today);

      // Sort by smallest difference first (closest to today)
      if (diffA !== diffB) {
        return diffA - diffB;
      }

      // If same distance from today, prefer future dates over past dates
      return dateB - dateA;
    });
  };

  const getAvailableWednesdays = () => {
    const availableWednesdays = [];
    const organizedDates = organizedMatches.map(match => match.date);
    const today = new Date();
    let currentDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    // Find the next Wednesday
    while (currentDate.getDay() !== 3) {
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // If today is already Wednesday, move to next Wednesday
    if (today.getDay() === 3 && today.getHours() > 12) {
      currentDate.setDate(currentDate.getDate() + 7);
    }

    // Check the next 9 Wednesdays
    for (let i = 0; i < 9; i++) {
      const wednesday = new Date(currentDate);
      wednesday.setDate(currentDate.getDate() + (i * 7));

      const year = wednesday.getFullYear();
      const month = String(wednesday.getMonth() + 1).padStart(2, '0');
      const day = String(wednesday.getDate()).padStart(2, '0');
      const dateString = `${year}-${month}-${day}`;

      // Only add if not already organized
      if (!organizedDates.includes(dateString)) {
        availableWednesdays.push(dateString);
      }
    }

    return availableWednesdays;
  };

  // Data fetching functions
  const refetchMatches = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${airtableUrl}?sort%5B0%5D%5Bfield%5D=Date&sort%5B0%5D%5Bdirection%5D=asc`, {
        headers: airtableHeaders
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      const matches = data.records.map(record => {
        let teams = null;
        let scores = null;

        // Safely parse Teams field
        try {
          if (record.fields.Teams) {
            teams = JSON.parse(record.fields.Teams);
          }
        } catch (error) {
          console.log('Error parsing Teams field for record:', record.id);
        }

        // Safely parse Scores field  
        try {
          if (record.fields.Scores) {
            scores = JSON.parse(record.fields.Scores);
          }
        } catch (error) {
          console.log('Error parsing Scores field for record:', record.id);
        }

        return {
          id: record.id,
          date: record.fields.Date || '',
          time: record.fields.Time || '',
          organizer: record.fields.Organizer || '',
          courts: record.fields.Courts || 2, // Default to 2 courts for backward compatibility
          signups: record.fields.Signups ? record.fields.Signups.split('\n').filter(s => s.trim()) : [],
          teams: teams,
          scores: scores,
          receipt1: record.fields.Receipt1 && Array.isArray(record.fields.Receipt1)
            ? record.fields.Receipt1[0].url
            : (record.fields.Receipt1 || null),
          receipt2: record.fields.Receipt2 && Array.isArray(record.fields.Receipt2)
            ? record.fields.Receipt2[0].url
            : (record.fields.Receipt2 || null)
        };
      });

      // Separate current and archived matches
      const currentMatches = matches.filter(match => !shouldArchiveMatch(match.date));
      const pastMatches = matches.filter(match => shouldArchiveMatch(match.date));

      // Sort both lists by proximity to today
      const sortedCurrentMatches = sortByProximityToToday([...currentMatches]);
      const sortedArchivedMatches = sortByProximityToToday([...pastMatches]);

      console.log('=== REFETCH MATCHES DEBUG ===');
      console.log('Total matches loaded:', matches.length);
      console.log('Current matches:', sortedCurrentMatches.length);
      console.log('Archived matches:', sortedArchivedMatches.length);
      console.log('==================');

      setOrganizedMatches(sortedCurrentMatches);
      setArchivedMatches(sortedArchivedMatches);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching matches:', error);
      alert('Error loading matches. Please check your internet connection and try again.');
      setLoading(false);
    }
  };

  // Event handlers
  const handleLogin = () => {
    const passwordValue = passwordRef.current?.value || '';
    if (passwordValue === '2026') {
      setIsAuthenticated(true);
      if (passwordRef.current) passwordRef.current.value = '';
    } else {
      alert('Incorrect password');
      if (passwordRef.current) passwordRef.current.value = '';
    }
  };

  const handleFileChange = (index, e) => {
    const file = e.target.files[0];
    if (file) {
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        alert('Please select a PDF or Image file (JPG, PNG, GIF)');
        e.target.value = '';
        return;
      }

      if (file.size > 5 * 1024 * 1024) { // 5MB total limit for selection
        alert('File is too large. Please select a file under 5MB.');
        e.target.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          let finalData = event.target.result;

          // Auto-compress images to stay under Airtable string limits
          if (file.type.startsWith('image/')) {
            finalData = await compressImage(finalData);
          } else if (file.size > 75 * 1024) {
            // Warning for PDFs/Others
            const proceed = window.confirm(`This PDF is ${Math.round(file.size / 1024)}KB. Airtable text fields have a 100,000 character limit. If this PDF is too large, it will be truncated and appear blank. Continue?`);
            if (!proceed) {
              e.target.value = '';
              return;
            }
          }

          setNewMatch(prev => {
            const newReceipts = [...(prev.receipts || ['', ''])];
            const newNames = [...(prev.receiptNames || ['', ''])];
            newReceipts[index] = finalData;
            newNames[index] = file.name;
            return { ...prev, receipts: newReceipts, receiptNames: newNames };
          });
        } catch (err) {
          console.error('Error processing upload:', err);
          alert('Error processing file. Please try again with a different file.');
          e.target.value = '';
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const addMatch = async () => {
    if (newMatch.date && newMatch.time && newMatch.organizer && newMatch.courts) {
      try {
        setLoading(true);

        const matchData = {
          fields: {
            Date: newMatch.date,
            Time: newMatch.time,
            Organizer: newMatch.organizer,
            Courts: newMatch.courts,
            Signups: newMatch.organizer,
            Receipt1: newMatch.receipts[0] || '',
            Receipt2: newMatch.courts === 2 ? (newMatch.receipts[1] || '') : ''
          }
        };

        console.log('Sending to Airtable:', matchData);

        const response = await fetch(airtableUrl, {
          method: 'POST',
          headers: airtableHeaders,
          body: JSON.stringify(matchData)
        });

        console.log('Response status:', response.status);

        if (!response.ok) {
          const errorData = await response.json();
          console.error('Airtable error response:', errorData);
          throw new Error(`HTTP error! status: ${response.status}, message: ${JSON.stringify(errorData)}`);
        }

        const responseData = await response.json();
        console.log('Success response:', responseData);

        setNewMatch({ date: '', time: '', organizer: '', courts: 2, receipts: ['', ''], receiptNames: ['', ''] });
        setCurrentView('matches');
        await refetchMatches();
      } catch (error) {
        console.error('Error adding match:', error);
        alert(`Error creating match: ${error.message}\n\nCheck the browser console for details.`);
        setLoading(false);
      }
    }
  };

  const openSignupModal = (matchId) => {
    setSignupModal({ isOpen: true, matchId, playerName: '' });
  };

  const closeSignupModal = () => {
    setSignupModal({ isOpen: false, matchId: null, playerName: '' });
  };

  const openResultsModal = (matchId) => {
    const match = archivedMatches.find(m => m.id === matchId);
    if (match) {
      setResultsModal({
        isOpen: true,
        matchId,
        teams: match.teams || [
          { player1: '', player2: '' },
          { player1: '', player2: '' },
          { player1: '', player2: '' },
          { player1: '', player2: '' }
        ],
        scores: match.scores || {
          set1: { match1: { team1: '', team2: '' }, match2: { team1: '', team2: '' } },
          set2: { match1: { team1: '', team2: '' }, match2: { team1: '', team2: '' } },
          set3: { match1: { team1: '', team2: '' }, match2: { team1: '', team2: '' } }
        }
      });
    }
  };

  const closeResultsModal = () => {
    setResultsModal({
      isOpen: false,
      matchId: null,
      teams: [
        { player1: '', player2: '' },
        { player1: '', player2: '' },
        { player1: '', player2: '' },
        { player1: '', player2: '' }
      ],
      scores: {
        set1: { match1: { team1: '', team2: '' }, match2: { team1: '', team2: '' } },
        set2: { match1: { team1: '', team2: '' }, match2: { team1: '', team2: '' } },
        set3: { match1: { team1: '', team2: '' }, match2: { team1: '', team2: '' } }
      }
    });
  };

  const handleSignupFromModal = async () => {
    const { matchId, playerName } = signupModal;

    if (!playerName.trim()) {
      alert('Please enter your name');
      return;
    }

    try {
      const match = organizedMatches.find(m => m.id === matchId) || archivedMatches.find(m => m.id === matchId);
      if (match && !match.signups.includes(playerName.trim())) {
        const updatedSignups = [...match.signups, playerName.trim()];

        const response = await fetch(`${airtableUrl}/${matchId}`, {
          method: 'PATCH',
          headers: airtableHeaders,
          body: JSON.stringify({
            fields: {
              Signups: updatedSignups.join('\n')
            }
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        closeSignupModal();
        await refetchMatches();
      } else if (match && match.signups.includes(playerName.trim())) {
        alert('You are already signed up for this match!');
      }
    } catch (error) {
      console.error('Error signing up:', error);
      alert('Error signing up. Please try again.');
    }
  };

  const handleSaveResults = async () => {
    try {
      setLoading(true);

      const response = await fetch(`${airtableUrl}/${resultsModal.matchId}`, {
        method: 'PATCH',
        headers: airtableHeaders,
        body: JSON.stringify({
          fields: {
            Teams: JSON.stringify(resultsModal.teams),
            Scores: JSON.stringify(resultsModal.scores)
          }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      closeResultsModal();
      await refetchMatches();
      setLoading(false);
    } catch (error) {
      console.error('Error saving results:', error);
      alert('Error saving results. Please try again.');
      setLoading(false);
    }
  };
  const openReceiptsModal = (matchId) => {
    const match = organizedMatches.find(m => m.id === matchId) || archivedMatches.find(m => m.id === matchId);
    if (match) {
      setReceiptsModal({
        isOpen: true,
        matchId: matchId,
        receipts: [match.receipt1 || '', match.receipt2 || ''],
        courts: match.courts || 1
      });
    }
  };

  const closeReceiptsModal = () => {
    setReceiptsModal({ isOpen: false, matchId: null, receipts: ['', ''], receiptNames: ['', ''], courts: 1 });
  };

  const handleReceiptFileChange = (index, e) => {
    const file = e.target.files[0];
    if (file) {
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        alert('Please select a PDF or Image file (JPG, PNG, GIF)');
        e.target.value = '';
        return;
      }

      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        alert('File is too large. Please select a file under 5MB.');
        e.target.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          let finalData = event.target.result;

          // Auto-compress images
          if (file.type.startsWith('image/')) {
            finalData = await compressImage(finalData);
          } else if (file.size > 75 * 1024) {
            const proceed = window.confirm(`This PDF is ${Math.round(file.size / 1024)}KB. Airtable text fields have a 100,000 character limit. If it's too large, it will break. Continue?`);
            if (!proceed) {
              e.target.value = '';
              return;
            }
          }

          setReceiptsModal(prev => {
            const newReceipts = [...(prev.receipts || ['', ''])];
            const newNames = [...(prev.receiptNames || ['', ''])];
            newReceipts[index] = finalData;
            newNames[index] = file.name;
            return { ...prev, receipts: newReceipts, receiptNames: newNames };
          });
        } catch (err) {
          console.error('Error processing receipt:', err);
          alert('Error processing file. Please try again.');
          e.target.value = '';
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveReceipts = async () => {
    try {
      setLoading(true);

      const response = await fetch(`${airtableUrl}/${receiptsModal.matchId}`, {
        method: 'PATCH',
        headers: airtableHeaders,
        body: JSON.stringify({
          fields: {
            Receipt1: receiptsModal.receipts[0] || '',
            Receipt2: receiptsModal.courts === 2 ? (receiptsModal.receipts[1] || '') : ''
          }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      closeReceiptsModal();
      await refetchMatches();
      setLoading(false);
    } catch (error) {
      console.error('Error saving receipts:', error);
      alert('Error saving receipts. Please try again.');
      setLoading(false);
    }
  };

  const cancelSignup = async (matchId, playerToRemove) => {
    const isConfirmed = window.confirm(
      `Are you sure you want to remove "${playerToRemove}" from this match?`
    );

    if (!isConfirmed) return;

    try {
      const match = organizedMatches.find(m => m.id === matchId) || archivedMatches.find(m => m.id === matchId);
      if (match) {
        const updatedSignups = match.signups.filter(player => player !== playerToRemove);

        const response = await fetch(`${airtableUrl}/${matchId}`, {
          method: 'PATCH',
          headers: airtableHeaders,
          body: JSON.stringify({
            fields: {
              Signups: updatedSignups.join('\n')
            }
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        await refetchMatches();
      }
    } catch (error) {
      console.error('Error canceling signup:', error);
      alert('Error canceling signup. Please try again.');
    }
  };

  const deleteMatch = async (matchId) => {
    const isConfirmed = window.confirm(
      'Are you sure you want to delete this entire match? This cannot be undone.'
    );

    if (!isConfirmed) return;

    try {
      const response = await fetch(`${airtableUrl}/${matchId}`, {
        method: 'DELETE',
        headers: airtableHeaders
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      await refetchMatches();
    } catch (error) {
      console.error('Error deleting match:', error);
      alert('Error deleting match. Please try again.');
    }
  };

  // Load matches when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;

    console.log('useEffect starting - authenticated');

    const testAuth = async () => {
      try {
        console.log('Testing Airtable authentication...');
        const response = await fetch(`https://api.airtable.com/v0/meta/bases`, {
          headers: {
            'Authorization': `Bearer ${AIRTABLE_API_KEY}`
          }
        });

        console.log('Auth test response status:', response.status);
        if (response.ok) {
          console.log('✅ Authentication working!');
        } else {
          const errorData = await response.json();
          console.error('❌ Authentication failed:', errorData);
        }
      } catch (error) {
        console.error('Auth test error:', error);
      }
    };

    const fetchMatches = async () => {
      try {
        console.log('Starting to fetch matches...');
        setLoading(true);
        const response = await fetch(`${airtableUrl}?sort%5B0%5D%5Bfield%5D=Date&sort%5B0%5D%5Bdirection%5D=asc`, {
          headers: airtableHeaders
        });

        console.log('Fetch response status:', response.status);

        if (!response.ok) {
          const errorData = await response.json();
          console.error('Fetch matches error:', errorData);
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Raw data received:', data);

        const matches = data.records.map(record => {
          let teams = null;
          let scores = null;

          try {
            if (record.fields.Teams) {
              teams = JSON.parse(record.fields.Teams);
            }
          } catch (error) {
            console.log('Error parsing Teams field for record:', record.id);
          }

          try {
            if (record.fields.Scores) {
              scores = JSON.parse(record.fields.Scores);
            }
          } catch (error) {
            console.log('Error parsing Scores field for record:', record.id);
          }

          return {
            id: record.id,
            date: record.fields.Date || '',
            time: record.fields.Time || '',
            organizer: record.fields.Organizer || '',
            courts: record.fields.Courts || 2, // Default to 2 courts for backward compatibility
            signups: record.fields.Signups ? record.fields.Signups.split('\n').filter(s => s.trim()) : [],
            teams: teams,
            scores: scores,
            receipt1: record.fields.Receipt1 && Array.isArray(record.fields.Receipt1)
              ? record.fields.Receipt1[0].url
              : (record.fields.Receipt1 || null),
            receipt2: record.fields.Receipt2 && Array.isArray(record.fields.Receipt2)
              ? record.fields.Receipt2[0].url
              : (record.fields.Receipt2 || null)
          };
        });

        // Separate current and archived matches
        const currentMatches = matches.filter(match => !shouldArchiveMatch(match.date));
        const pastMatches = matches.filter(match => shouldArchiveMatch(match.date));

        // Sort both lists by proximity to today
        const sortedCurrentMatches = sortByProximityToToday([...currentMatches]);
        const sortedArchivedMatches = sortByProximityToToday([...pastMatches]);

        console.log('=== MATCHES DEBUG ===');
        console.log('Total matches loaded:', matches.length);
        console.log('Current matches:', sortedCurrentMatches.length);
        console.log('Archived matches:', sortedArchivedMatches.length);
        console.log('Archived dates order:', sortedArchivedMatches.map(m => m.date));
        console.log('Sample archived match:', sortedArchivedMatches[0]);
        console.log('==================');

        setOrganizedMatches(sortedCurrentMatches);
        setArchivedMatches(sortedArchivedMatches);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching matches:', error);
        alert('Error loading matches. Please check your internet connection and try again.');
        setLoading(false);
      }
    };

    console.log('About to call testAuth()');
    testAuth();

    console.log('About to call fetchMatches()');
    fetchMatches();
  }, [isAuthenticated]);

  // Component definitions
  const SignupModal = () => {
    if (!signupModal.isOpen) return null;

    const match = organizedMatches.find(m => m.id === signupModal.matchId) || archivedMatches.find(m => m.id === signupModal.matchId);
    if (!match) return null;

    const isArchived = shouldArchiveMatch(match.date);
    const playerLimit = getPlayerLimit(match.courts);

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
          <div className="bg-black text-white p-4 rounded-t-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Sign Up for Match</h3>
              <button
                onClick={closeSignupModal}
                className="text-gray-300 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-gray-300 text-sm mt-1">
              {formatDate(match.date)} at {match.time}
            </p>
          </div>

          <div className="p-6">
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Name
              </label>
              <input
                type="text"
                value={signupModal.playerName}
                onChange={(e) => setSignupModal({ ...signupModal, playerName: e.target.value })}
                placeholder="Enter your full name"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleSignupFromModal()}
              />
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                Current signups: {match.signups.length}/{playerLimit} ({match.courts} court{match.courts === 1 ? '' : 's'})
              </p>
              {isArchived && (
                <p className="text-sm text-red-600 mb-2">
                  ⚠️ This match has already occurred and is archived.
                </p>
              )}
              {!isArchived && match.signups.length >= playerLimit && (
                <p className="text-sm text-amber-600">
                  ⚠️ This match is full. You'll be added to the waiting list.
                </p>
              )}
            </div>

            <div className="flex space-x-3">
              <button
                onClick={handleSignupFromModal}
                disabled={!signupModal.playerName.trim() || isArchived}
                className="flex-1 bg-black text-white py-2 px-4 rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {isArchived ? 'Match Archived' : 'Sign Me Up'}
              </button>
              <button
                onClick={closeSignupModal}
                className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-300 font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const ResultsModal = () => {
    if (!resultsModal.isOpen) return null;

    const match = archivedMatches.find(m => m.id === resultsModal.matchId);
    if (!match) return null;

    // Get assigned players
    const assignedPlayers = new Set();
    resultsModal.teams.forEach(team => {
      if (team.player1) assignedPlayers.add(team.player1);
      if (team.player2) assignedPlayers.add(team.player2);
    });

    // Get unassigned players
    const unassignedPlayers = match.signups.slice(0, 8).filter(player => !assignedPlayers.has(player));

    const updateScore = (set, matchNum, team, value) => {
      setResultsModal(prev => ({
        ...prev,
        scores: {
          ...prev.scores,
          [set]: {
            ...prev.scores[set],
            [matchNum]: {
              ...prev.scores[set][matchNum],
              [team]: value
            }
          }
        }
      }));
    };

    const getMatchupText = (set, matchNum) => {
      if (set === 'set1') {
        return matchNum === 'match1' ? 'Team 1 vs Team 2' : 'Team 3 vs Team 4';
      } else if (set === 'set2') {
        return matchNum === 'match1' ? 'Team 1 vs Team 3' : 'Team 2 vs Team 4';
      } else {
        return matchNum === 'match1' ? 'Team 1 vs Team 4' : 'Team 2 vs Team 3';
      }
    };

    const handleDragStart = (e, playerName) => {
      e.dataTransfer.setData('text/plain', playerName);
      e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e, teamIndex, position) => {
      e.preventDefault();
      const playerName = e.dataTransfer.getData('text/plain');

      const updatedTeams = resultsModal.teams.map(team => ({
        player1: team.player1 === playerName ? '' : team.player1,
        player2: team.player2 === playerName ? '' : team.player2
      }));

      updatedTeams[teamIndex][position] = playerName;

      setResultsModal({ ...resultsModal, teams: updatedTeams });
    };

    const handleRemovePlayer = (playerName) => {
      const updatedTeams = resultsModal.teams.map(team => ({
        player1: team.player1 === playerName ? '' : team.player1,
        player2: team.player2 === playerName ? '' : team.player2
      }));
      setResultsModal({ ...resultsModal, teams: updatedTeams });
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div className="bg-gray-600 text-white p-4 rounded-t-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Record Match Results</h3>
              <button
                onClick={closeResultsModal}
                className="text-gray-300 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-gray-300 text-sm mt-1">
              {formatDate(match.date)} at {match.time}
            </p>
          </div>

          <div className="p-6">
            <div className="mb-8">
              <h4 className="text-lg font-semibold mb-4">Available Players</h4>
              <p className="text-sm text-gray-600 mb-4">
                Drag players from this list into the teams below:
              </p>
              <div className="flex flex-wrap gap-2 p-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 min-h-[60px]">
                {unassignedPlayers.map((player, index) => (
                  <div
                    key={index}
                    draggable
                    onDragStart={(e) => handleDragStart(e, player)}
                    className="bg-white px-3 py-2 rounded-md border border-gray-300 cursor-move hover:bg-gray-100 hover:border-gray-400 select-none shadow-sm"
                  >
                    {player}
                  </div>
                ))}
                {unassignedPlayers.length === 0 && (
                  <p className="text-gray-500 italic">All players have been assigned to teams</p>
                )}
              </div>
            </div>

            <div className="mb-8">
              <h4 className="text-lg font-semibold mb-4">Teams</h4>
              <div className="grid md:grid-cols-2 gap-4">
                {resultsModal.teams.map((team, index) => (
                  <div key={index} className="border border-gray-300 rounded-lg p-4 bg-white">
                    <h5 className="font-medium mb-3">Team {index + 1}</h5>
                    <div className="space-y-3">
                      <div
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, index, 'player1')}
                        className="min-h-[50px] p-3 border-2 border-dashed border-gray-300 rounded-md hover:border-gray-400 hover:bg-gray-50 transition-colors"
                      >
                        {team.player1 ? (
                          <div className="flex items-center justify-between bg-blue-100 px-3 py-2 rounded border border-blue-300">
                            <span className="font-medium text-blue-900">{team.player1}</span>
                            <button
                              onClick={() => handleRemovePlayer(team.player1)}
                              className="text-red-500 hover:text-red-700 ml-2"
                              title="Remove player"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                            Drop Player 1 here
                          </div>
                        )}
                      </div>

                      <div
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, index, 'player2')}
                        className="min-h-[50px] p-3 border-2 border-dashed border-gray-300 rounded-md hover:border-gray-400 hover:bg-gray-50 transition-colors"
                      >
                        {team.player2 ? (
                          <div className="flex items-center justify-between bg-blue-100 px-3 py-2 rounded border border-blue-300">
                            <span className="font-medium text-blue-900">{team.player2}</span>
                            <button
                              onClick={() => handleRemovePlayer(team.player2)}
                              className="text-red-500 hover:text-red-700 ml-2"
                              title="Remove player"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                            Drop Player 2 here
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <h4 className="text-lg font-semibold mb-4">Match Scores</h4>
              <p className="text-sm text-gray-600 mb-4">
                Each team plays one set against each other team. Enter scores as "6-4", "7-5", etc.
              </p>

              <div className="space-y-6">
                <div className="border border-gray-300 rounded-lg p-4">
                  <h5 className="font-medium mb-3">Set 1</h5>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {getMatchupText('set1', 'match1')}
                      </label>
                      <div className="flex items-center space-x-2">
                        <select
                          value={resultsModal.scores.set1.match1.team1}
                          onChange={(e) => updateScore('set1', 'match1', 'team1', e.target.value)}
                          className="w-20 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
                        >
                          <option value="">-</option>
                          {[0, 1, 2, 3, 4, 5, 6, 7].map(num => (
                            <option key={num} value={num}>{num}</option>
                          ))}
                        </select>
                        <span className="text-gray-500">-</span>
                        <select
                          value={resultsModal.scores.set1.match1.team2}
                          onChange={(e) => updateScore('set1', 'match1', 'team2', e.target.value)}
                          className="w-20 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
                        >
                          <option value="">-</option>
                          {[0, 1, 2, 3, 4, 5, 6, 7].map(num => (
                            <option key={num} value={num}>{num}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {getMatchupText('set1', 'match2')}
                      </label>
                      <div className="flex items-center space-x-2">
                        <select
                          value={resultsModal.scores.set1.match2.team1}
                          onChange={(e) => updateScore('set1', 'match2', 'team1', e.target.value)}
                          className="w-20 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
                        >
                          <option value="">-</option>
                          {[0, 1, 2, 3, 4, 5, 6, 7].map(num => (
                            <option key={num} value={num}>{num}</option>
                          ))}
                        </select>
                        <span className="text-gray-500">-</span>
                        <select
                          value={resultsModal.scores.set1.match2.team2}
                          onChange={(e) => updateScore('set1', 'match2', 'team2', e.target.value)}
                          className="w-20 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
                        >
                          <option value="">-</option>
                          {[0, 1, 2, 3, 4, 5, 6, 7].map(num => (
                            <option key={num} value={num}>{num}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border border-gray-300 rounded-lg p-4">
                  <h5 className="font-medium mb-3">Set 2</h5>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {getMatchupText('set2', 'match1')}
                      </label>
                      <div className="flex items-center space-x-2">
                        <select
                          value={resultsModal.scores.set2.match1.team1}
                          onChange={(e) => updateScore('set2', 'match1', 'team1', e.target.value)}
                          className="w-20 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
                        >
                          <option value="">-</option>
                          {[0, 1, 2, 3, 4, 5, 6, 7].map(num => (
                            <option key={num} value={num}>{num}</option>
                          ))}
                        </select>
                        <span className="text-gray-500">-</span>
                        <select
                          value={resultsModal.scores.set2.match1.team2}
                          onChange={(e) => updateScore('set2', 'match1', 'team2', e.target.value)}
                          className="w-20 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
                        >
                          <option value="">-</option>
                          {[0, 1, 2, 3, 4, 5, 6, 7].map(num => (
                            <option key={num} value={num}>{num}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {getMatchupText('set2', 'match2')}
                      </label>
                      <div className="flex items-center space-x-2">
                        <select
                          value={resultsModal.scores.set2.match2.team1}
                          onChange={(e) => updateScore('set2', 'match2', 'team1', e.target.value)}
                          className="w-20 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
                        >
                          <option value="">-</option>
                          {[0, 1, 2, 3, 4, 5, 6, 7].map(num => (
                            <option key={num} value={num}>{num}</option>
                          ))}
                        </select>
                        <span className="text-gray-500">-</span>
                        <select
                          value={resultsModal.scores.set2.match2.team2}
                          onChange={(e) => updateScore('set2', 'match2', 'team2', e.target.value)}
                          className="w-20 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
                        >
                          <option value="">-</option>
                          {[0, 1, 2, 3, 4, 5, 6, 7].map(num => (
                            <option key={num} value={num}>{num}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border border-gray-300 rounded-lg p-4">
                  <h5 className="font-medium mb-3">Set 3</h5>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {getMatchupText('set3', 'match1')}
                      </label>
                      <div className="flex items-center space-x-2">
                        <select
                          value={resultsModal.scores.set3.match1.team1}
                          onChange={(e) => updateScore('set3', 'match1', 'team1', e.target.value)}
                          className="w-20 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
                        >
                          <option value="">-</option>
                          {[0, 1, 2, 3, 4, 5, 6, 7].map(num => (
                            <option key={num} value={num}>{num}</option>
                          ))}
                        </select>
                        <span className="text-gray-500">-</span>
                        <select
                          value={resultsModal.scores.set3.match1.team2}
                          onChange={(e) => updateScore('set3', 'match1', 'team2', e.target.value)}
                          className="w-20 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
                        >
                          <option value="">-</option>
                          {[0, 1, 2, 3, 4, 5, 6, 7].map(num => (
                            <option key={num} value={num}>{num}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {getMatchupText('set3', 'match2')}
                      </label>
                      <div className="flex items-center space-x-2">
                        <select
                          value={resultsModal.scores.set3.match2.team1}
                          onChange={(e) => updateScore('set3', 'match2', 'team1', e.target.value)}
                          className="w-20 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
                        >
                          <option value="">-</option>
                          {[0, 1, 2, 3, 4, 5, 6, 7].map(num => (
                            <option key={num} value={num}>{num}</option>
                          ))}
                        </select>
                        <span className="text-gray-500">-</span>
                        <select
                          value={resultsModal.scores.set3.match2.team2}
                          onChange={(e) => updateScore('set3', 'match2', 'team2', e.target.value)}
                          className="w-20 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
                        >
                          <option value="">-</option>
                          {[0, 1, 2, 3, 4, 5, 6, 7].map(num => (
                            <option key={num} value={num}>{num}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={handleSaveResults}
                disabled={loading}
                className="flex-1 bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {loading ? 'Saving...' : 'Save Results'}
              </button>
              <button
                onClick={closeResultsModal}
                className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-300 font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const PdfViewerModal = () => {
    if (!viewingPdf.isOpen) return null;

    const closeViewer = () => {
      // Clean up Blob URLs to prevent memory leaks
      if (viewingPdf.isBlob && viewingPdf.data && viewingPdf.data.startsWith('blob:')) {
        URL.revokeObjectURL(viewingPdf.data);
      }
      setViewingPdf({ isOpen: false, data: null, title: '' });
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60] p-4">
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col">
          <div className="bg-gray-800 text-white p-4 rounded-t-lg flex items-center justify-between">
            <div className="flex flex-col truncate">
              <h3 className="font-semibold truncate pr-4">{viewingPdf.title || 'Court Receipt'}</h3>
              {viewingPdf.isTruncated && (
                <span className="text-red-400 text-[10px] font-bold uppercase animate-pulse">
                  ⚠️ Error: This file was truncated by Airtable (too large)
                </span>
              )}
            </div>
            <button
              onClick={closeViewer}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="flex-1 bg-gray-100 flex flex-col items-center justify-center overflow-hidden relative">
            {viewingPdf.isTruncated ? (
              <div className="text-center p-8 max-w-md bg-white rounded-lg shadow-sm border border-red-100">
                <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <h4 className="text-lg font-bold text-gray-900 mb-2">Blank Page?</h4>
                <p className="text-sm text-gray-600 mb-4">
                  This file is too large for the database. Airtable has cut off the end of the file data, making it impossible to display.
                </p>
                <div className="bg-red-50 p-3 rounded text-left text-xs text-red-800 mb-6">
                  <strong>How to fix:</strong> Post a new version of this receipt that is a smaller file (under 75KB). Try taking a screenshot instead of saving a full PDF.
                </div>
                <button
                  onClick={closeViewer}
                  className="w-full bg-gray-800 text-white py-2 rounded font-medium hover:bg-gray-700"
                >
                  Close and Try Smaller File
                </button>
              </div>
            ) : (
              <div className="w-full h-full flex flex-col">
                <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
                  {viewingPdf.data && (viewingPdf.data.startsWith('data:image/') || (viewingPdf.isBlob && viewingPdf.originalData && viewingPdf.originalData.startsWith('data:image/'))) ? (
                    <img
                      src={viewingPdf.data}
                      alt="Receipt"
                      className="max-w-full max-h-full object-contain shadow-lg bg-white"
                    />
                  ) : (
                    <iframe
                      src={viewingPdf.data}
                      className="w-full h-full border-none bg-white rounded shadow-inner"
                      title="Receipt Viewer"
                    />
                  )}
                </div>

                <div className="bg-white border-t p-3 flex justify-center space-x-4 shrink-0">
                  <a
                    href={viewingPdf.data}
                    download={`receipt-${viewingPdf.title.replace(/\s+/g, '-').toLowerCase()}.pdf`}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium transition-colors"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download / Open Separately
                  </a>
                  <p className="text-[10px] text-gray-400 max-w-[200px] leading-tight flex items-center">
                    If the preview is blank, try the Download button to open in your system viewer.
                  </p>
                </div>
              </div>
            )}
          </div>
          <div className="bg-gray-50 p-3 rounded-b-lg border-t text-center">
            <button
              onClick={closeViewer}
              className="bg-gray-800 text-white px-8 py-2 rounded-md hover:bg-gray-700 font-medium transition-colors"
            >
              Close Viewer
            </button>
          </div>
        </div>
      </div>
    );
  };

  const ReceiptsModal = () => {
    if (!receiptsModal.isOpen) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-lg w-full overflow-y-auto">
          <div className="bg-gray-600 text-white p-4 rounded-t-lg flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center">
              <Upload className="h-5 w-5 mr-2" />
              Manage Court Receipts
            </h3>
            <button onClick={closeReceiptsModal} className="text-gray-300 hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-6">
            <p className="text-sm text-gray-600 mb-6">
              Upload PDF or Image receipts for the courts reserved for this match.
            </p>

            <div className="space-y-6">
              {[...Array(receiptsModal.courts)].map((_, i) => (
                <div key={i} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Court {i + 1} Receipt (PDF/Image)
                  </label>
                  <div className="flex items-center space-x-3">
                    <div className="flex-1">
                      <input
                        type="file"
                        accept=".pdf,image/*"
                        onChange={(e) => handleReceiptFileChange(i, e)}
                        className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-black file:text-white hover:file:bg-gray-800"
                      />
                    </div>
                    {receiptsModal.receipts[i] && (
                      <div className="flex flex-col items-center space-y-1">
                        <FileText className="h-6 w-6 text-green-600" title="File ready to upload" />
                        <span className="text-[10px] text-green-600 font-medium text-center">
                          {(receiptsModal.receipts[i]?.length || 0) >= 99000 ? '⚠️ Too Big' : ((receiptsModal.receipts[i]?.startsWith('http') || false) ? 'Stored' : 'New')}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setReceiptsModal(prev => {
                              const newRecs = [...(prev.receipts || ['', ''])];
                              const newNames = [...(prev.receiptNames || ['', ''])];
                              newRecs[i] = '';
                              newNames[i] = '';
                              return { ...prev, receipts: newRecs, receiptNames: newNames };
                            });
                          }}
                          className="text-[10px] text-red-500 hover:text-red-700 underline"
                        >
                          Clear
                        </button>
                      </div>
                    )}
                  </div>
                  {receiptsModal.receipts[i] && receiptsModal.receipts[i].startsWith('http') && (
                    <p className="text-[10px] text-blue-600 mt-1 italic">
                      Current receipt is already stored online. Uploading a new one will replace it.
                    </p>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-8 flex space-x-3">
              <button
                onClick={handleSaveReceipts}
                disabled={loading}
                className="flex-1 bg-black text-white py-2 px-4 rounded-md hover:bg-gray-800 disabled:opacity-50 font-medium"
              >
                {loading ? 'Saving...' : 'Save Receipts'}
              </button>
              <button
                onClick={closeReceiptsModal}
                className="flex-1 bg-gray-100 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-200 font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const MatchCard = ({ match, isArchived = false }) => {
    const playerLimit = getPlayerLimit(match.courts);

    return (
      <div key={match.id} className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className={`${isArchived ? 'bg-gray-600' : 'bg-black'} text-white p-4`}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">
                {formatShortDate(match.date)}
                {isArchived && <span className="ml-2 text-xs bg-gray-800 px-2 py-1 rounded">ARCHIVED</span>}
              </h3>
              <p className="text-gray-300 text-sm">
                {formatDate(match.date)}
              </p>
            </div>
            <div className="text-right">
              <div className="flex items-center text-gray-300">
                <Clock className="h-4 w-4 mr-1" />
                <span className="text-sm">{match.time}</span>
              </div>
              <div className="flex items-center text-gray-300 mt-1">
                <User className="h-4 w-4 mr-1" />
                <span className="text-sm">by {match.organizer}</span>
              </div>
              <div className="mt-2 flex flex-col items-end space-y-1">
                <button
                  onClick={() => openReceiptsModal(match.id)}
                  className="text-white/70 hover:text-white text-[10px] bg-white/10 px-2 py-1 rounded"
                  title="Manage receipts"
                >
                  Manage Receipts
                </button>
                {!isArchived && (
                  <button
                    onClick={() => deleteMatch(match.id)}
                    className="text-red-400 hover:text-red-300 text-[10px]"
                    title="Delete entire match"
                  >
                    Delete Match
                  </button>
                )}
                {isArchived && (
                  <button
                    onClick={() => openResultsModal(match.id)}
                    className="text-blue-400 hover:text-blue-300 text-[10px]"
                    title="Record match results"
                  >
                    {match.teams ? 'Edit Results' : 'Record Results'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {!isArchived && (
          <div className="p-4 border-b bg-gray-50">
            <button
              onClick={() => openSignupModal(match.id)}
              className="w-full px-4 py-2 bg-black text-white rounded-md hover:bg-gray-800 flex items-center justify-center font-medium"
            >
              <Plus className="h-4 w-4 mr-2" />
              Sign Up for This Match
            </button>
          </div>
        )}

        {isArchived && match.teams && match.scores && (
          <div className="p-4 border-b bg-blue-50">
            <h4 className="font-medium text-gray-900 mb-3">Match Results</h4>

            <div className="grid grid-cols-2 gap-2 mb-4">
              {match.teams.map((team, index) => (
                <div key={index} className="text-sm">
                  <span className="font-medium">Team {index + 1}:</span> {team.player1} & {team.player2}
                </div>
              ))}
            </div>

            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium">Set 1:</span>
                <span className="ml-2">T1 vs T2: {match.scores.set1.match1.team1}-{match.scores.set1.match1.team2}</span>
                <span className="ml-4">T3 vs T4: {match.scores.set1.match2.team1}-{match.scores.set1.match2.team2}</span>
              </div>
              <div>
                <span className="font-medium">Set 2:</span>
                <span className="ml-2">T1 vs T3: {match.scores.set2.match1.team1}-{match.scores.set2.match1.team2}</span>
                <span className="ml-4">T2 vs T4: {match.scores.set2.match2.team1}-{match.scores.set2.match2.team2}</span>
              </div>
              <div>
                <span className="font-medium">Set 3:</span>
                <span className="ml-2">T1 vs T4: {match.scores.set3.match1.team1}-{match.scores.set3.match1.team2}</span>
                <span className="ml-4">T2 vs T3: {match.scores.set3.match2.team1}-{match.scores.set3.match2.team2}</span>
              </div>
            </div>
          </div>
        )}

        <div className="p-4">
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                Confirmed Players
                <span className="ml-2 bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded-full">
                  {Math.min(match.signups.length, playerLimit)}/{playerLimit}
                </span>
                <span className="ml-2 text-xs text-gray-500">
                  ({match.courts} court{match.courts === 1 ? '' : 's'})
                </span>
              </h4>
              <div className="space-y-2">
                {match.signups.slice(0, playerLimit).map((player, index) => (
                  <div key={index} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-md">
                    <span className="text-sm">
                      <span className="font-medium text-gray-700">#{index + 1}</span>
                      <span className="ml-2">{player}</span>
                      {player === match.organizer && (
                        <span className="ml-2 text-xs bg-black text-white px-2 py-0.5 rounded">ORGANIZER</span>
                      )}
                    </span>
                    {!isArchived && (
                      <button
                        onClick={() => cancelSignup(match.id, player)}
                        className="text-red-500 hover:text-red-700 opacity-75 hover:opacity-100"
                        title="Cancel signup"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
                {match.signups.length === 0 && (
                  <div className="text-sm text-gray-500 italic px-3 py-2">
                    No players signed up yet
                  </div>
                )}
                {match.signups.length > 0 && match.signups.length < playerLimit && (
                  <div className="text-sm text-gray-500 italic px-3 py-2">
                    {playerLimit - match.signups.length} spots remaining
                  </div>
                )}
              </div>
            </div>

            {match.signups.length > playerLimit && (
              <div>
                <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                  <AlertCircle className="h-4 w-4 mr-1 text-gray-500" />
                  Waiting List
                  <span className="ml-2 bg-gray-200 text-gray-800 text-xs px-2 py-1 rounded-full">
                    {match.signups.length - playerLimit}
                  </span>
                </h4>
                <div className="space-y-2">
                  {match.signups.slice(playerLimit).map((player, index) => (
                    <div key={index} className="flex items-center justify-between bg-gray-100 px-3 py-2 rounded-md">
                      <span className="text-sm">
                        <span className="font-medium text-gray-700">#{index + playerLimit + 1}</span>
                        <span className="ml-2">{player}</span>
                      </span>
                      {!isArchived && (
                        <button
                          onClick={() => cancelSignup(match.id, player)}
                          className="text-red-500 hover:text-red-700 opacity-75 hover:opacity-100"
                          title="Cancel signup"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(match.receipt1 || match.receipt2) && (
              <div className="pt-4 border-t border-gray-100">
                <h4 className="font-medium text-gray-900 mb-2 flex items-center">
                  <FileText className="h-4 w-4 mr-1 text-gray-500" />
                  Court Receipts
                </h4>
                <div className="flex flex-wrap gap-2">
                  {match.receipt1 && (
                    <button
                      onClick={() => viewReceipt(match.receipt1, `Receipt 1 - ${formatShortDate(match.date)}`)}
                      className="inline-flex items-center px-3 py-1 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm transition-colors"
                    >
                      <Download className="h-3 w-3 mr-1" />
                      Court 1 Receipt
                    </button>
                  )}
                  {match.receipt2 && (
                    <button
                      onClick={() => viewReceipt(match.receipt2, `Receipt 2 - ${formatShortDate(match.date)}`)}
                      className="inline-flex items-center px-3 py-1 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm transition-colors"
                    >
                      <Download className="h-3 w-3 mr-1" />
                      Court 2 Receipt
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const LoginForm = () => (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center">
              <div className="w-6 h-6 bg-white rounded-full"></div>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Dimond Tennis</h1>
          <p className="text-gray-600 mt-2">Wednesday Night Doubles</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Enter Password
            </label>
            <input
              type="password"
              ref={passwordRef}
              placeholder="Password"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black"
              autoComplete="off"
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            />
          </div>

          <button
            onClick={handleLogin}
            className="w-full bg-black text-white py-2 px-4 rounded-md hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black font-medium"
          >
            Access Site
          </button>
        </div>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            Private access for Dimond Tennis players
          </p>
        </div>
      </div>
    </div>
  );

  if (!isAuthenticated) {
    return <LoginForm />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 bg-black rounded-full mr-3 animate-pulse"></div>
          <p className="text-gray-600 mt-2">Loading matches...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-black text-white shadow-lg">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex-1"></div>
            <div className="text-center">
              <div className="flex items-center justify-center mb-2">
                <div className="w-8 h-8 bg-white rounded-full mr-3"></div>
                <h1 className="text-3xl font-bold">Dimond Tennis</h1>
              </div>
              <p className="text-gray-300">Wednesday Night Doubles</p>
            </div>
            <div className="flex-1 flex justify-end">
              <button
                onClick={() => setIsAuthenticated(false)}
                className="text-gray-300 hover:text-white text-sm px-3 py-1 rounded border border-gray-600 hover:border-gray-400"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <nav className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex space-x-8 justify-center">
            <button
              onClick={() => setCurrentView('matches')}
              className={`py-4 px-2 border-b-2 font-medium text-sm ${currentView === 'matches'
                ? 'border-black text-black'
                : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
            >
              Current Matches
            </button>
            <button
              onClick={() => setCurrentView('archived')}
              className={`py-4 px-2 border-b-2 font-medium text-sm ${currentView === 'archived'
                ? 'border-black text-black'
                : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
            >
              Archived Matches ({archivedMatches.length})
            </button>
            <button
              onClick={() => setCurrentView('organize')}
              className={`py-4 px-2 border-b-2 font-medium text-sm ${currentView === 'organize'
                ? 'border-black text-black'
                : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
            >
              Organize Match
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {currentView === 'matches' && (
          <div>
            <div className="bg-white rounded-lg shadow-md p-6 mb-8">
              <div className="text-center">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Wednesday Night Doubles</h2>
                <p className="text-gray-600">Click "Sign Up" below to join any match. Enter your name when prompted.</p>
              </div>
            </div>

            {organizedMatches.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No current matches organized</h3>
                <p className="text-gray-500 mb-4">Someone needs to reserve courts and organize a match first</p>
                <button
                  onClick={() => setCurrentView('organize')}
                  className="bg-black text-white px-6 py-2 rounded-md hover:bg-gray-800"
                >
                  Organize a Match
                </button>
              </div>
            ) : (
              <div className="grid lg:grid-cols-2 gap-6">
                {organizedMatches.map(match => (
                  <MatchCard key={match.id} match={match} isArchived={false} />
                ))}
              </div>
            )}
          </div>
        )}

        {currentView === 'archived' && (
          <div>
            <div className="bg-white rounded-lg shadow-md p-6 mb-8">
              <div className="text-center">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Archived Matches</h2>
                <p className="text-gray-600">Past matches are automatically archived the day after they occur.</p>
              </div>
            </div>

            {archivedMatches.length === 0 ? (
              <div className="text-center py-12">
                <Archive className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No archived matches</h3>
                <p className="text-gray-500">Past matches will appear here automatically</p>
              </div>
            ) : (
              <div className="grid lg:grid-cols-2 gap-6">
                {archivedMatches.map(match => (
                  <MatchCard key={match.id} match={match} isArchived={true} />
                ))}
              </div>
            )}
          </div>
        )}

        {currentView === 'organize' && (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Organize a Match</h2>
              <p className="text-gray-600">Reserve courts and let others know about your Wednesday match</p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-2xl mx-auto">
              <h3 className="font-medium text-blue-900 mb-2 flex items-center">
                <ExternalLink className="h-4 w-4 mr-2" />
                First: Reserve Courts Online
              </h3>
              <p className="text-sm text-blue-800 mb-3">
                Before organizing a match, you must reserve courts at the City of Oakland website:
              </p>
              <a
                href="https://cityofoakland.perfectmind.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700"
              >
                Reserve Courts at Oakland Parks
                <ExternalLink className="h-4 w-4 ml-2" />
              </a>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6 max-w-lg mx-auto">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Wednesday Date
                  </label>
                  <select
                    value={newMatch.date}
                    onChange={(e) => setNewMatch({ ...newMatch, date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black"
                  >
                    <option value="">Select a Wednesday</option>
                    {getAvailableWednesdays().map(date => (
                      <option key={date} value={date}>
                        {formatDate(date)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Number of Courts
                  </label>
                  <select
                    value={newMatch.courts}
                    onChange={(e) => setNewMatch({ ...newMatch, courts: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black"
                  >
                    <option value={1}>1 Court (4 players max)</option>
                    <option value={2}>2 Courts (8 players max)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Time
                  </label>
                  <input
                    type="text"
                    value={newMatch.time}
                    onChange={(e) => setNewMatch({ ...newMatch, time: e.target.value })}
                    placeholder="e.g., 6:00 PM - 8:00 PM"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Your Name (Organizer)
                  </label>
                  <input
                    type="text"
                    value={newMatch.organizer}
                    onChange={(e) => setNewMatch({ ...newMatch, organizer: e.target.value })}
                    placeholder="Your name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>

                <div className="pt-4 border-t border-gray-100">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                    <Upload className="h-4 w-4 mr-2" />
                    Upload PDF or Image Receipts
                  </h4>
                  <div className="space-y-4">
                    {[...Array(newMatch.courts)].map((_, i) => (
                      <div key={i}>
                        <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">
                          Court {i + 1} Receipt (PDF/Image)
                        </label>
                        <div className="flex items-center space-x-2">
                          <div className="relative flex-1">
                            <input
                              type="file"
                              accept=".pdf,image/*"
                              onChange={(e) => handleFileChange(i, e)}
                              className="w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-black file:text-white hover:file:bg-gray-800"
                            />
                          </div>
                          {newMatch.receipts[i] && (
                            <div className="flex flex-col items-center">
                              <FileText className="h-5 w-5 text-green-600" title="File ready to upload" />
                              {newMatch.receiptNames[i] && (
                                <span className="text-[10px] text-gray-500 mt-0.5 truncate max-w-[80px]">
                                  {newMatch.receiptNames[i]}
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setNewMatch(prev => {
                                    const newRecs = [...(prev.receipts || ['', ''])];
                                    const newNames = [...(prev.receiptNames || ['', ''])];
                                    newRecs[i] = '';
                                    newNames[i] = '';
                                    return { ...prev, receipts: newRecs, receiptNames: newNames };
                                  });
                                }}
                                className="text-[10px] text-red-500 hover:text-red-700 underline mt-1"
                              >
                                Clear
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={addMatch}
                  disabled={!newMatch.date || !newMatch.time || !newMatch.organizer || !newMatch.courts || loading}
                  className="w-full px-4 py-2 bg-black text-white rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {loading ? 'Creating...' : 'Create Match'}
                </button>
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-md p-4 max-w-lg mx-auto">
              <h3 className="font-medium text-gray-900 mb-2">How organizing works:</h3>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• Reserve 1 or 2 courts at cityofoakland.perfectmind.com first</li>
                <li>• Post your match here with date, time, and court count</li>
                <li>• 1 court = 4 players max, 2 courts = 8 players max</li>
                <li>• You'll be automatically signed up as player #1</li>
                <li>• Other players can sign up (up to the court limit)</li>
                <li>• Additional signups go on a waiting list</li>
              </ul>
            </div>
          </div>
        )}

        <div className="mt-12 bg-white rounded-lg shadow-md p-6">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">About Wednesday Night Doubles</h3>
            <div className="grid md:grid-cols-2 gap-6 text-sm text-gray-600 max-w-4xl mx-auto">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Location</h4>
                <p>Dimond Park Tennis Courts<br />3860 Hanly Rd, Oakland, CA 94602</p>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Court Reservations</h4>
                <p>Reserve courts through the City of Oakland<br />
                  <a href="https://cityofoakland.perfectmind.com/" target="_blank" rel="noopener noreferrer" className="text-black hover:text-gray-700">
                    cityofoakland.perfectmind.com
                  </a></p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <SignupModal />
      <ResultsModal />
      <ReceiptsModal />
      <PdfViewerModal />
    </div>
  );
};

export default DimondTennisApp;