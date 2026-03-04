const testApi = async () => {
    const res = await fetch('http://localhost:3000/api/prizes', {
        headers: { 'x-admin-password': 'admin' } // ensure this matches the local password which defaults to 'admin'
    });
    console.log("Status:", res.status);
    const data = await res.json();
    console.log("Returned Prizes:", data.length);
    console.log("Is Admin logic worked if length is 18?:", data.length === 18);
};

testApi();
