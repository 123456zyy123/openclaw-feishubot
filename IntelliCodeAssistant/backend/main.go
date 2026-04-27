package main

import (
	quanwengo "backend/quanwen.go"
	"os"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {

	r := gin.Default()
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	r.POST("/api/agent/run", quanwengo.Conn)
	r.Run(":8080")

	go func() {
		time.Sleep(100 * time.Second)
		os.Exit(0)
	}()
}
