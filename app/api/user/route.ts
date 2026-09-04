import { NextResponse } from "next/server"

export async function GET() {
    return NextResponse.json(JSON.stringify({
        "name": "Gerome",
        "age": 26
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