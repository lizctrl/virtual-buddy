
export async function GET(request: Request) {
    const { id } = request.params
    return new Response(JSON.stringify({
        "name": "Gerome",
        "age": 25
    }), {
        status: 200,
        headers: {
            'Content-Type': 'application/json'
        }
    })
}
export async function POST(request: Request) {
    const body = await request.json()
    const { } = body

    console.log(body)
    return new Response(JSON.stringify(body), {
        status: 201,
        headers: {
            'Content-Type': 'application/json'
        }
    })
}