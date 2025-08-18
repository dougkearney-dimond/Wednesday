import React, { useState, useEffect, useRef } from 'react';
import { Calendar, Clock, Trash2, Plus, AlertCircle, ExternalLink, User } from 'lucide-react';

// Airtable Configuration - Using environment variables for security
const AIRTABLE_API_KEY = process.env.REACT_APP_AIRTABLE_API_KEY || 'your_airtable_api_key_here';
const AIRTABLE_BASE_ID = process.env.REACT_APP_AIRTABLE_BASE_ID || 'your_base_id_here';
const AIRTABLE_TABLE_NAME = 'Matches';

// Debug: Log the URL being used (but NOT the API key)
console.log('Airtable URL:', `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_NAME}`);
console.log('API Key configured:', AIRTABLE_API_KEY ? 'Yes' : 'No');

// Airtable API configuration
const airtableHeaders = {
  'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
  'Content-Type': 'application/json'
};

const airtableUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_NAME}`;

const DimondTennisApp = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentView, setCurrentView] = useState('matches');
  const [playerName, setPlayerName] = useState('');
  const [organizedMatches, setOrganizedMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef(null);
  
  const [newMatch, setNewMatch] = useState({
    date: '',
    time: '',
    organizer: ''
  });

  // Generate Wednesday dates
  const generateWednesdays = () => {
    const wednesdays = [];
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
    
    // Generate 8 consecutive Wednesdays
    for (let i = 0; i < 8; i++) {
      const wednesday = new Date(currentDate);
      wednesday.setDate(currentDate.getDate() + (i * 7));
      
      const year = wednesday.getFullYear();
      const month = String(wednesday.getMonth() + 1).padStart(2, '0');
      const day = String(wednesday.getDate()).padStart(2, '0');
      const dateString = `${year}-${month}-${day}`;
      
      wednesdays.push(dateString);
    }
    
    return wednesdays;
  };

  // Load matches when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;

    // Fetch matches from Airtable - moved inside useEffect to avoid dependency issues
    const fetchMatches = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${airtableUrl}?sort%5B0%5D%5Bfield%5D=Date&sort%5B0%5D%5Bdirection%5D=asc`, {
          headers: airtableHeaders
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        const matches = data.records.map(record => ({
          id: record.id,
          date: record.fields.Date || '',
          time: record.fields.Time || '',
          organizer: record.fields.Organizer || '',
          signups: record.fields.Signups ? record.fields.Signups.split('\n').filter(s => s.trim()) : []
        }));
        
        setOrganizedMatches(matches);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching matches:', error);
        alert('Error loading matches. Please check your internet connection and try again.');
        setLoading(false);
      }
    };

    fetchMatches();
  }, [isAuthenticated]);

  // Separate fetchMatches function for use in other parts of the component
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
      
      const matches = data.records.map(record => ({
        id: record.id,
        date: record.fields.Date || '',
        time: record.fields.Time || '',
        organizer: record.fields.Organizer || '',
        signups: record.fields.Signups ? record.fields.Signups.split('\n').filter(s => s.trim()) : []
      }));
      
      setOrganizedMatches(matches);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching matches:', error);
      alert('Error loading matches. Please check your internet connection and try again.');
      setLoading(false);
    }
  };

  // Password authentication
  const handleLogin = () => {
    const passwordValue = passwordRef.current?.value || '';
    if (passwordValue === 'tennis2025') {
      setIsAuthenticated(true);
      if (passwordRef.current) passwordRef.current.value = '';
    } else {
      alert('Incorrect password');
      if (passwordRef.current) passwordRef.current.value = '';
    }
  };

  // Add new match to Airtable
  const addMatch = async () => {
    if (newMatch.date && newMatch.time && newMatch.organizer) {
      try {
        setLoading(true);
        
        const matchData = {
          fields: {
            Date: newMatch.date,
            Time: newMatch.time,
            Organizer: newMatch.organizer,
            Signups: newMatch.organizer // Organizer automatically signs up
          }
        };

        console.log('Sending to Airtable:', matchData); // Debug log

        const response = await fetch(airtableUrl, {
          method: 'POST',
          headers: airtableHeaders,
          body: JSON.stringify(matchData)
        });

        console.log('Response status:', response.status); // Debug log

        if (!response.ok) {
          const errorData = await response.json();
          console.error('Airtable error response:', errorData); // Debug log
          throw new Error(`HTTP error! status: ${response.status}, message: ${JSON.stringify(errorData)}`);
        }

        const responseData = await response.json();
        console.log('Success response:', responseData); // Debug log

        setNewMatch({ date: '', time: '', organizer: '' });
        setCurrentView('matches');
        await refetchMatches(); // Refresh the matches list
      } catch (error) {
        console.error('Error adding match:', error);
        alert(`Error creating match: ${error.message}\n\nCheck the browser console for details.`);
        setLoading(false);
      }
    }
  };

  // Sign up for a match
  const signUpForMatch = async (matchId) => {
    if (!playerName.trim()) return;
    
    try {
      const match = organizedMatches.find(m => m.id === matchId);
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

        setPlayerName('');
        await refetchMatches(); // Refresh the matches list
      }
    } catch (error) {
      console.error('Error signing up:', error);
      alert('Error signing up. Please try again.');
    }
  };

  // Cancel signup
  const cancelSignup = async (matchId, playerToRemove) => {
    const isConfirmed = window.confirm(
      `Are you sure you want to remove "${playerToRemove}" from this match?`
    );
    
    if (!isConfirmed) return;
    
    try {
      const match = organizedMatches.find(m => m.id === matchId);
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

        await refetchMatches(); // Refresh the matches list
      }
    } catch (error) {
      console.error('Error canceling signup:', error);
      alert('Error canceling signup. Please try again.');
    }
  };

  // Delete entire match
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

      await refetchMatches(); // Refresh the matches list
    } catch (error) {
      console.error('Error deleting match:', error);
      alert('Error deleting match. Please try again.');
    }
  };

  // Login form component
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

  // Return login form if not authenticated
  if (!isAuthenticated) {
    return <LoginForm />;
  }

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

  const getAvailableWednesdays = () => {
    const allWednesdays = generateWednesdays();
    const organizedDates = organizedMatches.map(match => match.date);
    return allWednesdays.filter(date => !organizedDates.includes(date));
  };

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
      {/* Header */}
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

      {/* Navigation */}
      <nav className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex space-x-8 justify-center">
            <button
              onClick={() => setCurrentView('matches')}
              className={`py-4 px-2 border-b-2 font-medium text-sm ${
                currentView === 'matches'
                  ? 'border-black text-black'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              View Matches
            </button>
            <button
              onClick={() => setCurrentView('organize')}
              className={`py-4 px-2 border-b-2 font-medium text-sm ${
                currentView === 'organize'
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
            {/* Quick Signup */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-8">
              <div className="text-center">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Sign Up for Matches</h2>
                <div className="flex justify-center space-x-3 max-w-md mx-auto">
                  <input
                    type="text"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    placeholder="Enter your name"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>
                <p className="text-sm text-gray-600 mt-2">Enter your name above, then click "Sign Up" for any match below</p>
              </div>
            </div>

            {/* Organized Matches */}
            {organizedMatches.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No matches organized yet</h3>
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
                  <div key={match.id} className="bg-white rounded-lg shadow-md overflow-hidden">
                    {/* Match Header */}
                    <div className="bg-black text-white p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-semibold">
                            {formatShortDate(match.date)}
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
                          <button
                            onClick={() => deleteMatch(match.id)}
                            className="mt-2 text-red-400 hover:text-red-300 text-xs"
                            title="Delete entire match"
                          >
                            Delete Match
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Sign Up Button */}
                    <div className="p-4 border-b bg-gray-50">
                      <button
                        onClick={() => signUpForMatch(match.id)}
                        disabled={!playerName.trim() || match.signups.includes(playerName.trim())}
                        className="w-full px-4 py-2 bg-black text-white rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center font-medium"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        {match.signups.includes(playerName.trim()) ? 'Already Signed Up' : 'Sign Up for This Match'}
                      </button>
                    </div>

                    {/* Players List */}
                    <div className="p-4">
                      <div className="space-y-4">
                        {/* Confirmed Players */}
                        <div>
                          <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                            Confirmed Players
                            <span className="ml-2 bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded-full">
                              {Math.min(match.signups.length, 8)}/8
                            </span>
                          </h4>
                          <div className="space-y-2">
                            {match.signups.slice(0, 8).map((player, index) => (
                              <div key={index} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-md">
                                <span className="text-sm">
                                  <span className="font-medium text-gray-700">#{index + 1}</span>
                                  <span className="ml-2">{player}</span>
                                  {player === match.organizer && (
                                    <span className="ml-2 text-xs bg-black text-white px-2 py-0.5 rounded">ORGANIZER</span>
                                  )}
                                </span>
                                <button
                                  onClick={() => cancelSignup(match.id, player)}
                                  className="text-red-500 hover:text-red-700 opacity-75 hover:opacity-100"
                                  title="Cancel signup"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            ))}
                            {match.signups.length === 0 && (
                              <div className="text-sm text-gray-500 italic px-3 py-2">
                                No players signed up yet
                              </div>
                            )}
                            {match.signups.length > 0 && match.signups.length < 8 && (
                              <div className="text-sm text-gray-500 italic px-3 py-2">
                                {8 - match.signups.length} spots remaining
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Waiting List */}
                        {match.signups.length > 8 && (
                          <div>
                            <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                              <AlertCircle className="h-4 w-4 mr-1 text-gray-500" />
                              Waiting List
                              <span className="ml-2 bg-gray-200 text-gray-800 text-xs px-2 py-1 rounded-full">
                                {match.signups.length - 8}
                              </span>
                            </h4>
                            <div className="space-y-2">
                              {match.signups.slice(8).map((player, index) => (
                                <div key={index} className="flex items-center justify-between bg-gray-100 px-3 py-2 rounded-md">
                                  <span className="text-sm">
                                    <span className="font-medium text-gray-700">#{index + 9}</span>
                                    <span className="ml-2">{player}</span>
                                  </span>
                                  <button
                                    onClick={() => cancelSignup(match.id, player)}
                                    className="text-red-500 hover:text-red-700 opacity-75 hover:opacity-100"
                                    title="Cancel signup"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
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

            {/* Court Reservation Info */}
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
                    onChange={(e) => setNewMatch({...newMatch, date: e.target.value})}
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
                    Time
                  </label>
                  <input
                    type="text"
                    value={newMatch.time}
                    onChange={(e) => setNewMatch({...newMatch, time: e.target.value})}
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
                    onChange={(e) => setNewMatch({...newMatch, organizer: e.target.value})}
                    placeholder="Your name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>

                <button
                  onClick={addMatch}
                  disabled={!newMatch.date || !newMatch.time || !newMatch.organizer || loading}
                  className="w-full px-4 py-2 bg-black text-white rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {loading ? 'Creating...' : 'Create Match'}
                </button>
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-md p-4 max-w-lg mx-auto">
              <h3 className="font-medium text-gray-900 mb-2">How organizing works:</h3>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• Reserve courts at cityofoakland.perfectmind.com first</li>
                <li>• Post your match here with date and time</li>
                <li>• You'll be automatically signed up as player #1</li>
                <li>• Other players can sign up (8 total spots)</li>
                <li>• Additional signups go on a waiting list</li>
              </ul>
            </div>

            {/* Airtable Access Info */}
            <div className="bg-green-50 border border-green-200 rounded-md p-4 max-w-lg mx-auto">
              <h3 className="font-medium text-green-900 mb-2">Admin Access:</h3>
              <p className="text-sm text-green-800 mb-3">
                You can also view and manage all matches directly in Airtable:
              </p>
              <a 
                href={`https://airtable.com/${AIRTABLE_BASE_ID}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center bg-green-600 text-white px-4 py-2 rounded-md text-sm hover:bg-green-700"
              >
                Open Airtable Database
                <ExternalLink className="h-4 w-4 ml-2" />
              </a>
            </div>
          </div>
        )}

        {/* Footer Info */}
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
    </div>
  );
};

export default DimondTennisApp;